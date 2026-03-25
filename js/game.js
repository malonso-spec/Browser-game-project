// ============================================================
// Game Logic — state, turns, card resolution
// ============================================================
const game = {
  playerHP: 100,
  enemyHP: 100,
  turn: 1,
  consumedCards: [],    // permanently consumed (R only)
  isProcessing: false,
  shieldActive: false,
  heavyUsed: false,
  isDrunk: false,
  earlyHeavyDone: false,  // T1-T3: Heavy already happened
  earlyDrunkDone: false,  // T1-T3: Drunk already happened
  consecutiveHits: 0,
  critCyclePos: 0,      // 0=30, 1=40, 2=50 — resets when Rock Invocation is used
  startTime: null,       // timestamp when battle starts
  elapsedSeconds: 0      // seconds elapsed at game end
};

function getCritDmg() {
  return CRIT_CYCLE_DMG[game.critCyclePos];
}

function isCardAvailable(id) {
  return !game.consumedCards.includes(id);
}

function init() {
  Object.assign(game, {
    playerHP: 100,
    enemyHP: 100,
    turn: 1,
    consumedCards: [],
    isProcessing: false,
    shieldActive: false,
    heavyUsed: false,
    isDrunk: false,
    earlyHeavyDone: false,
    earlyDrunkDone: false,
    consecutiveHits: 0,
    critCyclePos: 0,
    startTime: Date.now(),
    elapsedSeconds: 0
  });

  _healBase = -1;
  $('playerHealFill').style.opacity = '0';
  updateUI(game.playerHP, game.enemyHP, game.turn);
  $('drunkStatus').textContent = '';
  $('drunkStatus').classList.add('hidden');
  $('result').classList.add('hidden');

  // Clean up any mid-flight animation state
  const botCanvas = $('botCanvas');
  const userCanvas = $('userCanvas');
  botCanvas.classList.remove('defeated', 'z-front');
  botCanvas.style.animation = '';
  userCanvas.classList.remove('defeated', 'shield-glow');
  userCanvas.style.animation = '';

  // Stop all combat animators so they don't draw over idle sprites
  userAttackAnim.stop();
  userAttackRevAnim.stop();
  userRockAttackAnim.stop();
  lightningAnim.stop();
  $('lightningCanvas').style.display = 'none';
  userHealAnim.stop();
  botAttackAnim.stop();
  botDefenseAnim.stop();
  userDefenseAnim.stop();

  updateCritIndicator();
  renderCards(game);
  dealCards();
  startIdleAnimations();
  trackGameStart(playerName);
}

function updateCritIndicator() {
  const critDmg = getCritDmg();
  const el = $('bonusIndicator');
  el.className = 'bonus-indicator bonus-available';
  el.textContent = '\u26A1 Rock Invocation: ' + critDmg + 'p';
}

async function playCard(id) {
  if (game.isProcessing) return;
  if (game.enemyHP <= 0 || game.playerHP <= 0) return;
  if (!isCardAvailable(id)) return;

  game.isProcessing = true;
  const card = CARDS.find(c => c.id === id);

  renderCards(game);

  // --- Resolve card ---
  if (card.type === 'attack') {
    let dmg = card.baseDmg;
    if (game.isDrunk) dmg = Math.round(dmg * 0.5);
    game.enemyHP = Math.max(0, game.enemyHP - dmg);
    shake($('enemyFighter'));
    await playPlayerAttack(game.enemyHP <= 0, false, () => {
      updateUI(game.playerHP, game.enemyHP, game.turn);
    });

  } else if (card.type === 'crit') {
    let dmg = getCritDmg();
    if (game.isDrunk) dmg = Math.round(dmg * 0.5);
    game.enemyHP = Math.max(0, game.enemyHP - dmg);
    game.critCyclePos = 0; // reset cycle after use
    shake($('enemyFighter'));
    await playPlayerAttack(game.enemyHP <= 0, true, () => {
      updateUI(game.playerHP, game.enemyHP, game.turn);
    });

  } else if (card.type === 'heal') {
    const oldHP = game.playerHP;
    game.playerHP = Math.min(100, game.playerHP + card.heal);
    game.shieldActive = true;
    game.consumedCards.push('R');
    showHealFill(oldHP, game.playerHP);
    await playHealAnimation();
    updateUI(game.playerHP, game.enemyHP, game.turn);

  } else if (card.type === 'food') {
    if (game.isDrunk) {
      game.isDrunk = false;
      game.consecutiveHits = 0;
      $('drunkStatus').textContent = '';
      $('drunkStatus').classList.add('hidden');
    }
    // If not drunk, Food has no effect (wastes the turn)
    updateUI(game.playerHP, game.enemyHP, game.turn);
    await delay(400);
  }

  renderCards(game);

  // --- Check enemy defeated ---
  if (game.enemyHP <= 0) {
    await delay(800);
    endGame(true, 'You defeated the enemy!');
    return;
  }

  // --- Enemy counterattack ---
  await delay(800);
  let enemyDmg;
  let heavyHappened = false;

  // T1-T3 guarantee: both Heavy AND Drunk must happen (on different turns)
  let mustHeavy = false;
  let mustDrunk = false;
  if (game.turn <= 3 && !game.shieldActive) {
    const turnsLeft = 3 - game.turn; // turns remaining after this one
    const needHeavy = !game.earlyHeavyDone;
    const needDrunk = !game.earlyDrunkDone && !game.isDrunk;
    const eventsNeeded = (needHeavy ? 1 : 0) + (needDrunk ? 1 : 0);
    if (eventsNeeded > 0 && eventsNeeded > turnsLeft) {
      // Must trigger at least one event this turn to fit both in T1-T3
      if (needHeavy && needDrunk) {
        if (Math.random() < 0.5) mustHeavy = true;
        else mustDrunk = true;
      } else if (needHeavy) mustHeavy = true;
      else if (needDrunk) mustDrunk = true;
    }
  }

  if (game.shieldActive) {
    enemyDmg = ENEMY_DMG_BLOCKED;
    game.shieldActive = false;
  } else if (game.turn <= 3 && !game.heavyUsed) {
    // T1-T3: Heavy with 33% chance (or forced), but not if Drunk is forced this turn
    if (mustHeavy || (!mustDrunk && Math.random() < ENEMY_CRIT_CHANCE_EARLY)) {
      enemyDmg = ENEMY_CRIT_DMG;
      heavyHappened = true;
      game.heavyUsed = true;
      game.earlyHeavyDone = true;
    } else {
      enemyDmg = ENEMY_DMG;
    }
  } else if (!game.heavyUsed && game.turn > 3) {
    // T4+: Heavy with 40% (if never used in battle)
    if (Math.random() < ENEMY_CRIT_CHANCE_LATE) {
      enemyDmg = ENEMY_CRIT_DMG;
      heavyHappened = true;
      game.heavyUsed = true;
    } else {
      enemyDmg = ENEMY_DMG;
    }
  } else {
    enemyDmg = ENEMY_DMG;
  }

  game.playerHP = Math.max(0, game.playerHP - enemyDmg);
  const willKillPlayer = game.playerHP <= 0;
  const isCrit = heavyHappened;
  await playEnemyAttack(willKillPlayer, () => {
    if (isCrit) showCritAlert();
    removeShieldGlow();
    shake($('playerFighter'));
    updateUI(game.playerHP, game.enemyHP, game.turn);
  });

  // --- Check player defeated ---
  if (game.playerHP <= 0) {
    await delay(800);
    endGame(false, 'Your HP reached 0%. Use Recovery and Food strategically!');
    return;
  }

  // --- Drunk mechanic ---
  if (!game.isDrunk) {
    if (game.turn <= 3) {
      // T1-T3: Drunk guaranteed, but not on same turn as Heavy
      if (!heavyHappened && !game.earlyDrunkDone) {
        game.consecutiveHits++;
        const chanceIndex = Math.min(game.consecutiveHits - 1, 2);
        if (mustDrunk || Math.random() < DRUNK_CHANCES[chanceIndex]) {
          game.isDrunk = true;
          game.consecutiveHits = 0;
          game.earlyDrunkDone = true;
          $('drunkStatus').textContent = '\uD83C\uDF7A DRUNK \u2014 Attacks deal 50% damage';
          $('drunkStatus').classList.remove('hidden');
        }
      }
    } else if (!heavyHappened) {
      // T4+: Drunk can happen, but never on the same turn as Heavy
      game.consecutiveHits++;
      const chanceIndex = Math.min(game.consecutiveHits - 1, 2);
      if (Math.random() < DRUNK_CHANCES[chanceIndex]) {
        game.isDrunk = true;
        game.consecutiveHits = 0;
        $('drunkStatus').textContent = '\uD83C\uDF7A DRUNK \u2014 Attacks deal 50% damage';
        $('drunkStatus').classList.remove('hidden');
      }
    }
  }

  // --- Next turn ---
  game.turn++;

  // Advance crit cycle if Rock Invocation was NOT used this turn
  if (card.type !== 'crit') {
    game.critCyclePos = Math.min(game.critCyclePos + 1, 2);
  }

  updateCritIndicator();
  updateUI(game.playerHP, game.enemyHP, game.turn);
  game.isProcessing = false;
  renderCards(game);
  showYourTurn();
}

async function endGame(win, reason) {
  game.elapsedSeconds = Math.round((Date.now() - game.startTime) / 1000);
  trackGameEnd(playerName, win, game.playerHP, game.turn, game.elapsedSeconds);
  showResult(win, reason);

  if (win) {
    const score = await saveScore(playerName, game.playerHP, game.turn, game.elapsedSeconds);
    showScoreAndLeaderboard(score, playerName);
  }
}

function restart() {
  init();
}

// Wait for all sprite frames to be pre-decoded, then start
allPreloaded.then(() => init());
