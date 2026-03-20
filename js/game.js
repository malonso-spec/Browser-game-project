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
  earlyEventUsed: false,  // T1-T3: once Drunk or Heavy happens, the other is blocked
  consecutiveHits: 0,
  critCyclePos: 0       // 0=30, 1=40, 2=50 — resets when Rock Invocation is used
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
    earlyEventUsed: false,
    consecutiveHits: 0,
    critCyclePos: 0
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
  if (game.shieldActive) {
    enemyDmg = ENEMY_DMG_BLOCKED;
    game.shieldActive = false;
  } else if (!game.heavyUsed && !(game.turn <= 3 && game.earlyEventUsed)) {
    const heavyChance = game.turn <= 3 ? ENEMY_CRIT_CHANCE_EARLY : ENEMY_CRIT_CHANCE_LATE;
    if (Math.random() < heavyChance) {
      enemyDmg = ENEMY_CRIT_DMG;
      heavyHappened = true;
      game.heavyUsed = true;
      if (game.turn <= 3) game.earlyEventUsed = true;
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
      // T1-T3: Drunk OR Heavy, never both in the entire T1-T3 phase
      if (!heavyHappened && !game.earlyEventUsed) {
        game.consecutiveHits++;
        const chanceIndex = Math.min(game.consecutiveHits - 1, 2);
        if (Math.random() < DRUNK_CHANCES[chanceIndex]) {
          game.isDrunk = true;
          game.consecutiveHits = 0;
          game.earlyEventUsed = true;
          showDrunkBanner();
          $('drunkStatus').textContent = '\uD83C\uDF7A DRUNK \u2014 Attacks deal 50% damage';
          $('drunkStatus').classList.remove('hidden');
        }
      }
    } else {
      // T4+: Drunk can happen regardless of Heavy
      game.consecutiveHits++;
      const chanceIndex = Math.min(game.consecutiveHits - 1, 2);
      if (Math.random() < DRUNK_CHANCES[chanceIndex]) {
        game.isDrunk = true;
        game.consecutiveHits = 0;
        showDrunkBanner();
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

function endGame(win, reason) {
  showResult(win, reason);
}

function restart() {
  init();
}

// Wait for all sprite frames to be pre-decoded, then start
allPreloaded.then(() => init());
