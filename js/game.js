const game = {
  playerHP: 100,
  enemyHP: 100,
  turn: 1,
  usedCards: [],
  enemyState: '',
  bonusUsed: false,
  bonusAvailable: true,
  isProcessing: false,
  shieldActive: false,
  enemyCritUsed: false
};

function init() {
  game.playerHP = 100;
  game.enemyHP = 100;
  game.turn = 1;
  game.usedCards = [];
  game.bonusUsed = false;
  game.bonusAvailable = true;
  game.isProcessing = false;
  game.shieldActive = false;
  game.enemyCritUsed = false;
  game.enemyState = STATES[Math.floor(Math.random() * STATES.length)];

  updateUI(game.playerHP, game.enemyHP, game.turn, game.usedCards);
  document.getElementById('enemyState').textContent = 'Estado: ' + game.enemyState;
  document.getElementById('stateHint').textContent = game.enemyState;
  document.getElementById('log').innerHTML = '';
  document.getElementById('result').classList.add('hidden');
  document.getElementById('bonusIndicator').className = 'bonus-indicator bonus-available';
  document.getElementById('bonusIndicator').textContent = '⚡ Bonus: T1 +10p | T2 +20p | T3 +30p';

  renderCards(game);
  playVideo(VIDEO_DEFAULT, true);
  addLog(game.turn, `¡Combate iniciado! El enemigo está ${game.enemyState}.`, 'system-msg');
  addLog(game.turn, '⚡ Bonus escalonado: T1 +10p | T2 +20p | T3 +30p ¡Arriesga para ganar más!', 'system-msg');
}

async function playCard(id) {
  if (game.usedCards.includes(id) || game.isProcessing || game.enemyHP <= 0 || game.playerHP <= 0 || game.turn > 5) return;

  game.isProcessing = true;
  game.usedCards.push(id);
  const card = CARDS.find(c => c.id === id);
  const bonusCard = STATE_CARD_MAP[game.enemyState];

  renderCards(game);
  await delay(200);

  if (card.isHeal) {
    const oldHP = game.playerHP;
    game.playerHP = Math.min(100, game.playerHP + card.heal);
    const healed = game.playerHP - oldHP;
    game.shieldActive = true;
    addLog(game.turn, `Usas ${card.name}: +${healed}p HP (${oldHP}% → ${game.playerHP}%) 🛡️ ¡Blindado!`, 'bonus-msg');
  } else {
    let dmg = card.baseDmg;

    if (id === bonusCard && !game.bonusUsed && game.turn <= 3) {
      const bonusAmount = BONUS_PER_TURN[game.turn];
      dmg += bonusAmount;
      game.bonusUsed = true;
      document.getElementById('bonusIndicator').className = 'bonus-indicator bonus-used';
      document.getElementById('bonusIndicator').textContent = `✓ Bonus T${game.turn}: +${bonusAmount}p`;
      addLog(game.turn, `¡BONUS T${game.turn}! ${card.name}: -${dmg}p (${card.baseDmg}+${bonusAmount})`, 'bonus-msg');
    } else {
      addLog(game.turn, `Usas ${card.name}: -${dmg}p al enemigo`, 'player-action');
    }

    game.enemyHP = Math.max(0, game.enemyHP - dmg);
    shake(document.getElementById('enemyFighter'));
  }

  updateUI(game.playerHP, game.enemyHP, game.turn, game.usedCards);
  await delay(600);

  if (game.enemyHP <= 0) {
    if (game.bonusUsed) {
      endGame(true, '¡Activaste el bonus y derrotaste al enemigo!');
    } else {
      endGame(false, 'Derrotaste al enemigo pero sin activar el bonus. ¡El bonus es obligatorio para ganar!');
    }
    return;
  }

  if (game.turn > 3 && !game.bonusUsed) {
    document.getElementById('bonusIndicator').className = 'bonus-indicator bonus-missed';
    document.getElementById('bonusIndicator').textContent = '✗ Bonus perdido';
  }

  await delay(300);

  await playEnemyAttackVideo();

  let enemyDmg;

  if (game.shieldActive) {
    enemyDmg = ENEMY_DMG_BLOCKED;
    game.shieldActive = false;
    addLog(game.turn, `🛡️ Escudo activo! El enemigo solo hace: -${enemyDmg}p`, 'player-action');
  } else if (!game.enemyCritUsed && Math.random() < CRIT_CHANCE) {
    enemyDmg = ENEMY_CRIT_DMG;
    game.enemyCritUsed = true;
    showCritAlert();
    addLog(game.turn, `¡CRÍTICO! El enemigo contraataca: -${enemyDmg}p`, 'enemy-crit');
  } else {
    enemyDmg = ENEMY_DMG;
    addLog(game.turn, `El enemigo contraataca: -${enemyDmg}p`, 'enemy-action');
  }

  game.playerHP = Math.max(0, game.playerHP - enemyDmg);
  shake(document.getElementById('playerFighter'));
  updateUI(game.playerHP, game.enemyHP, game.turn, game.usedCards);

  await delay(500);

  if (game.playerHP <= 0) {
    endGame(false, 'Tu vida llegó a 0%. ¡Intenta usar Recuperación estratégicamente!');
    return;
  }

  game.turn++;

  if (game.turn > 5) {
    if (game.enemyHP > 0) {
      endGame(false, 'Se acabaron los turnos y el enemigo sigue vivo.');
    }
    return;
  }

  updateUI(game.playerHP, game.enemyHP, game.turn, game.usedCards);
  game.isProcessing = false;
  renderCards(game);
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function endGame(win, reason) {
  showResult(win, reason);
  addLog(game.turn, win ? '¡Victoria!' : 'Derrota: ' + reason, 'system-msg');
}

function restart() {
  init();
}

init();
