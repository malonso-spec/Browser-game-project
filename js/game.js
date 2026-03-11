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
  $('botCanvas').classList.remove('defeated');
  $('userCanvas').classList.remove('defeated');
  $('bonusIndicator').className = 'bonus-indicator bonus-available';
  $('bonusIndicator').textContent = '⚡ Bonus: T1 +10p | T2 +20p | T3 +30p';

  renderCards(game);
  startIdleAnimations();
}

async function playCard(id) {
  if (game.usedCards.includes(id) || game.isProcessing) return;
  if (game.enemyHP <= 0 || game.playerHP <= 0 || game.turn > 5) return;

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

    if (id === bonusCard && !game.bonusUsed && game.turn <= 3) {
      const bonus = BONUS_PER_TURN[game.turn];
      dmg += bonus;
      game.bonusUsed = true;
      $('bonusIndicator').className = 'bonus-indicator bonus-used';
      $('bonusIndicator').textContent = `✓ Bonus T${game.turn}: +${bonus}p`;
    }

    game.enemyHP = Math.max(0, game.enemyHP - dmg);
    shake($('enemyFighter'));
    await playPlayerAttack(game.enemyHP <= 0);
  }

  updateUI(game.playerHP, game.enemyHP, game.turn, game.usedCards);

  // --- Check enemy defeated ---
  if (game.enemyHP <= 0) {
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
    showCritAlert();
  } else {
    enemyDmg = ENEMY_DMG;
  }

  const willKillPlayer = game.playerHP - enemyDmg <= 0;
  await playEnemyAttack(willKillPlayer);

  game.playerHP = Math.max(0, game.playerHP - enemyDmg);
  shake($('playerFighter'));
  updateUI(game.playerHP, game.enemyHP, game.turn, game.usedCards);

  // --- Check player defeated ---
  if (game.playerHP <= 0) {
    endGame(false, 'Tu vida llegó a 0%. ¡Intenta usar Recuperación estratégicamente!');
    return;
  }

  // --- Next turn ---
  game.turn++;
  if (game.turn > 5) {
    endGame(false, 'Se acabaron los turnos y el enemigo sigue vivo.');
    return;
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
