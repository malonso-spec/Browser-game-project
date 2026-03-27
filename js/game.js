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
  heavyCount: 0,         // max 2 per battle
  isDrunk: false,
  earlyPlan: [],          // Pre-assigned T1-T3 events: ['heavy','drunk','nothing'] shuffled
  consecutiveHits: 0,
  critCyclePos: 0,      // 0=25, 1=40, 2=50 — resets when Rock Invocation is used
  camperoBoostActive: false,  // next bot normal attack does 20 instead of 25
  lastDrunkTurn: 0,          // track last drunk activation turn to prevent consecutive T4+
  startTime: null,       // timestamp when battle starts
  elapsedSeconds: 0      // seconds elapsed at game end
};

// Fisher-Yates shuffle
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
    heavyCount: 0,
    isDrunk: false,
    earlyPlan: shuffleArray(['heavy', 'drunk', 'nothing']),
    consecutiveHits: 0,
    critCyclePos: 0,
    camperoBoostActive: false,
    lastDrunkTurn: 0,
    startTime: Date.now(),
    elapsedSeconds: 0
  });

  _healBase = -1;
  _prevPlayerHP = 100;
  _prevEnemyHP = 100;
  $('playerHealFill').style.opacity = '0';
  updateUI(game.playerHP, game.enemyHP, game.turn);
  $('drunkStatus').textContent = '';
  $('drunkStatus').classList.add('hidden');
  $('drunkNameTag').classList.add('hidden');
  stopDrunkBubbles();
  $('result').classList.add('hidden');
  $('infoBtn').classList.remove('hidden');

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
  botHeavyAttackAnim.stop();
  botHeavyReverseAnim.stop();
  botLaughAnim.stop();
  userFoodAnim.stop();
  userDrunkAnim.stop();
  userDefenseAnim.stop();

  updateCritIndicator();
  renderCards(game);
  dealCards();
  startIdleAnimations();
  stopGameTimer();
  _timerSeconds = 0;
  updateTimerDisplay(0);
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

  // --- Play drunk reaction at the start of each turn while drunk ---
  if (game.isDrunk && card.type !== 'food') {
    const skipIdleRestart = (card.type === 'attack' || card.type === 'crit');
    await playDrunkReaction(skipIdleRestart);
  }

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
    await playFoodAnimation();
    // Always heal 10 HP
    const oldHP = game.playerHP;
    game.playerHP = Math.min(100, game.playerHP + card.heal);
    if (oldHP !== game.playerHP) showHealFill(oldHP, game.playerHP, '#4ade80');
    if (game.isDrunk) {
      game.isDrunk = false;
      game.consecutiveHits = 0;
      stopDrunkBubbles();
      $('drunkNameTag').classList.add('hidden');
    }
    game.camperoBoostActive = true; // next bot normal attack does 20 dmg
    updateUI(game.playerHP, game.enemyHP, game.turn);
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

  // Determine what happens this turn
  const plannedEvent = (game.turn <= 3) ? game.earlyPlan[game.turn - 1] : null;

  if (game.shieldActive) {
    // Shield has absolute priority — blocks any attack to 10 dmg
    enemyDmg = ENEMY_DMG_BLOCKED;
    game.shieldActive = false;
    // If Heavy was planned, it's NOT consumed — reschedule to a later T1-T3 turn
    if (plannedEvent === 'heavy') {
      // Swap Heavy with the next 'nothing' slot, or the next available slot
      for (let i = game.turn; i < 3; i++) {
        if (game.earlyPlan[i] === 'nothing') {
          game.earlyPlan[i] = 'heavy';
          game.earlyPlan[game.turn - 1] = 'nothing';
          break;
        }
      }
    }
  } else if (plannedEvent === 'heavy') {
    // T1-T3: Planned Heavy attack
    enemyDmg = ENEMY_CRIT_DMG;
    heavyHappened = true;
    game.heavyCount++;
  } else if (game.heavyCount < 2 && game.turn > 3) {
    // T4+: Heavy with 40% (max 2 per battle)
    if (Math.random() < ENEMY_CRIT_CHANCE_LATE) {
      enemyDmg = ENEMY_CRIT_DMG;
      heavyHappened = true;
      game.heavyCount++;
    } else {
      enemyDmg = ENEMY_DMG;
    }
  } else {
    enemyDmg = ENEMY_DMG;
  }

  // Campero Boost reduces next normal attack to 20 dmg
  if (game.camperoBoostActive && enemyDmg === ENEMY_DMG) {
    enemyDmg = 20;
  }
  game.camperoBoostActive = false;

  game.playerHP = Math.max(0, game.playerHP - enemyDmg);
  const willKillPlayer = game.playerHP <= 0;
  const isCrit = heavyHappened;
  await playEnemyAttack(willKillPlayer, () => {
    if (isCrit) { showCritAlert(); playSfx('assets/Heavy-sound.mp3', 0.35, 2.0); }
    removeShieldGlow();
    shake($('playerFighter'));
    updateUI(game.playerHP, game.enemyHP, game.turn);
  }, isCrit);

  // --- Check player defeated ---
  if (game.playerHP <= 0) {
    await delay(800);
    endGame(false, 'Your HP reached 0%. Use Recovery and Food strategically!');
    return;
  }

  // --- Drunk mechanic ---
  if (!game.isDrunk) {
    if (plannedEvent === 'drunk') {
      // T1-T3: Planned Drunk activation
      game.isDrunk = true;
      game.consecutiveHits = 0;
      game.lastDrunkTurn = game.turn;
      // Bot heals 5 HP when Drunk activates
      game.enemyHP = Math.min(100, game.enemyHP + 5);
      showDrunkBanner();
      startDrunkBubbles();
      $('drunkNameTag').classList.remove('hidden');
      updateUI(game.playerHP, game.enemyHP, game.turn);
      await Promise.all([playDrunkReaction(), playBotLaugh()]);
    } else if (game.turn > 3 && !heavyHappened && game.lastDrunkTurn < game.turn - 1) {
      // T4+: Drunk can happen by probability, never on same turn as Heavy, never consecutive
      game.consecutiveHits++;
      const chanceIndex = Math.min(game.consecutiveHits - 1, 2);
      if (Math.random() < DRUNK_CHANCES[chanceIndex]) {
        game.isDrunk = true;
        game.consecutiveHits = 0;
        game.lastDrunkTurn = game.turn;
        // Bot heals 5 HP when Drunk activates
        game.enemyHP = Math.min(100, game.enemyHP + 5);
        showDrunkBanner();
        startDrunkBubbles();
        $('drunkNameTag').classList.remove('hidden');
        updateUI(game.playerHP, game.enemyHP, game.turn);
        await Promise.all([playDrunkReaction(), playBotLaugh()]);
      }
    }
  }

  // --- Next turn ---
  game.turn++;

  // Advance crit cycle if Rock Invocation was NOT used this turn
  // Cycle wraps: 0(30) → 1(40) → 2(50) → 0(30) → ...
  if (card.type !== 'crit') {
    game.critCyclePos = (game.critCyclePos + 1) % 3;
  }

  updateCritIndicator();
  updateUI(game.playerHP, game.enemyHP, game.turn);
  game.isProcessing = false;
  renderCards(game);
  showYourTurn();
}

async function endGame(win, reason) {
  stopGameTimer();
  $('infoBtn').classList.add('hidden');
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
  startGameTimer();
}

// Wait for all sprite frames to be pre-decoded, then start
allPreloaded.then(() => init());
