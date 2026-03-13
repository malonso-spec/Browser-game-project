// ============================================================
// Game Logic — state, turns, card resolution
// ============================================================
const game = {
  playerHP: 100,
  enemyHP: 100,
  turn: 1,
  usedCards: [],
  enemyState: '',
  bonusUsed: false,
  isProcessing: false,
  shieldActive: false,
  enemyCritUsed: false
};

function init() {
  Object.assign(game, {
    playerHP: 100,
    enemyHP: 100,
    turn: 1,
    usedCards: [],
    bonusUsed: false,
    isProcessing: false,
    shieldActive: false,
    enemyCritUsed: false,
    enemyState: STATES[Math.floor(Math.random() * STATES.length)]
  });

  updateUI(game.playerHP, game.enemyHP, game.turn, game.usedCards);
  $('enemyState').textContent = 'Estado: ' + game.enemyState;
  $('stateHint').textContent = game.enemyState;
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
  $('bonusIndicator').className = 'bonus-indicator bonus-available';
  $('bonusIndicator').textContent = '⚡ Bonus: T1 +10p | T2 +20p | T3 +30p';

  renderCards(game);
  dealCards();
  startIdleAnimations();
}

async function playCard(id) {
  if (game.usedCards.includes(id) || game.isProcessing) return;
  if (game.enemyHP <= 0 || game.playerHP <= 0) return;

  game.isProcessing = true;
  game.usedCards.push(id);
  const card = CARDS.find(c => c.id === id);
  const bonusCard = STATE_CARD_MAP[game.enemyState];

  renderCards(game);

  // --- Resolve card ---
  if (card.isHeal) {
    game.playerHP = Math.min(100, game.playerHP + card.heal);
    game.shieldActive = true;
  } else {
    let dmg = card.baseDmg;
    let isBonus = false;

    if (id === bonusCard && !game.bonusUsed && game.turn <= 3) {
      const bonus = BONUS_PER_TURN[game.turn];
      dmg += bonus;
      isBonus = true;
      game.bonusUsed = true;
      $('bonusIndicator').className = 'bonus-indicator bonus-used';
      $('bonusIndicator').textContent = `✓ Bonus T${game.turn}: +${bonus}p`;
    }

    game.enemyHP = Math.max(0, game.enemyHP - dmg);
    shake($('enemyFighter'));
    await playPlayerAttack(game.enemyHP <= 0, isBonus, () => {
      updateUI(game.playerHP, game.enemyHP, game.turn, game.usedCards);
    });
  }

  // Heal path — play bubble animation then update UI
  if (card.isHeal) {
    await playHealAnimation();
    updateUI(game.playerHP, game.enemyHP, game.turn, game.usedCards);
  }

  // --- Check enemy defeated ---
  if (game.enemyHP <= 0) {
    await delay(800);
    endGame(game.bonusUsed, game.bonusUsed
      ? '¡Activaste el bonus y derrotaste al enemigo!'
      : 'Derrotaste al enemigo pero sin activar el bonus. ¡El bonus es obligatorio para ganar!');
    return;
  }

  if (game.turn > 3 && !game.bonusUsed) {
    $('bonusIndicator').className = 'bonus-indicator bonus-missed';
    $('bonusIndicator').textContent = '✗ Bonus perdido';
  }

  // --- Enemy counterattack ---
  let enemyDmg;
  if (game.shieldActive) {
    enemyDmg = ENEMY_DMG_BLOCKED;
    game.shieldActive = false;
  } else if (!game.enemyCritUsed && Math.random() < CRIT_CHANCE) {
    enemyDmg = ENEMY_CRIT_DMG;
    game.enemyCritUsed = true;
  } else {
    enemyDmg = ENEMY_DMG;
  }

  game.playerHP = Math.max(0, game.playerHP - enemyDmg);
  const willKillPlayer = game.playerHP <= 0;
  const isCrit = enemyDmg === ENEMY_CRIT_DMG;
  await playEnemyAttack(willKillPlayer, () => {
    if (isCrit) showCritAlert();
    removeShieldGlow();
    shake($('playerFighter'));
    updateUI(game.playerHP, game.enemyHP, game.turn, game.usedCards);
  });

  // --- Check player defeated ---
  if (game.playerHP <= 0) {
    await delay(800);
    endGame(false, 'Tu vida llegó a 0%. ¡Intenta usar Recuperación estratégicamente!');
    return;
  }

  // --- Next turn ---
  game.turn++;

  // Disable Rock Invocation after turn 3, reactivate a random used card
  const bonusCardId = STATE_CARD_MAP[game.enemyState];
  if (game.turn > 3 && !game.usedCards.includes(bonusCardId)) {
    game.usedCards.push(bonusCardId);
    // Reactivate a random previously used card (not the bonus card)
    const reactivatable = game.usedCards.filter(id => id !== bonusCardId);
    if (reactivatable.length > 0) {
      const pick = reactivatable[Math.floor(Math.random() * reactivatable.length)];
      game.usedCards = game.usedCards.filter(id => id !== pick);
    }
  }

  // If all cards are used, re-enable a random one (not Recuperación nor bonus card)
  const allCardIds = CARDS.map(c => c.id);
  const availableCards = allCardIds.filter(id => !game.usedCards.includes(id));
  if (availableCards.length === 0) {
    const bonusCardId2 = STATE_CARD_MAP[game.enemyState];
    const reactivatable2 = game.usedCards.filter(id => id !== 'R' && id !== bonusCardId2);
    if (reactivatable2.length > 0) {
      const pick2 = reactivatable2[Math.floor(Math.random() * reactivatable2.length)];
      game.usedCards = game.usedCards.filter(id => id !== pick2);
    }
  }

  updateUI(game.playerHP, game.enemyHP, game.turn, game.usedCards);
  game.isProcessing = false;
  renderCards(game);
}

function endGame(win, reason) {
  showResult(win, reason);
}

function restart() {
  init();
}

// Wait for all sprite frames to be pre-decoded, then start
allPreloaded.then(() => init());
