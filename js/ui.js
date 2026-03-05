function updateUI(playerHP, enemyHP, turn, usedCards) {
  document.getElementById('playerHP').textContent = playerHP;
  document.getElementById('enemyHP').textContent = enemyHP;
  document.getElementById('playerHealthBar').style.width = playerHP + '%';
  document.getElementById('enemyHealthBar').style.width = enemyHP + '%';
  document.getElementById('turnCount').textContent = turn;
  document.getElementById('currentTurn').textContent = turn;
  document.getElementById('cardsLeft').textContent = 5 - usedCards.length;
}

function renderCards(game) {
  const container = document.getElementById('cards');
  const bonusCard = STATE_CARD_MAP[game.enemyState];

  container.innerHTML = CARDS.map(c => {
    const isUsed = game.usedCards.includes(c.id);
    const isBonusMatch = c.id === bonusCard && !game.bonusUsed && game.turn <= 3;
    const classes = ['card'];
    if (isUsed) classes.push('used');
    if (game.isProcessing) classes.push('disabled');
    if (isBonusMatch && !isUsed) classes.push('bonus-match');
    if (c.isHeal) classes.push('heal');

    return `
      <div class="${classes.join(' ')}" onclick="playCard('${c.id}')" data-id="${c.id}">
        <span class="card-letter">${c.id}</span>
        <span class="card-icon">${c.icon}</span>
        <span class="card-name">${c.name}</span>
        ${c.isHeal ? `
          <span class="card-damage"><strong>+${c.heal}p</strong> HP</span>
        ` : `
          <span class="card-damage">Daño: <strong>${c.baseDmg}p</strong></span>
          ${c.hasBonus ? `<span class="card-bonus">+Bonus si ${c.state}</span>` : ''}
        `}
      </div>
    `;
  }).join('');
}

function addLog(turn, msg, type) {
  const log = document.getElementById('log');
  log.innerHTML += `<div class="log-entry ${type}">[T${turn}] ${msg}</div>`;
  log.scrollTop = log.scrollHeight;
}

function shake(el) {
  if (!el) return;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 400);
}

function showCritAlert() {
  const alert = document.getElementById('critAlert');
  alert.classList.remove('hidden');
  setTimeout(() => alert.classList.add('hidden'), 600);
}

function playVideo(src, loop = false) {
  const video = document.querySelector('.arena-video');
  video.src = src;
  video.loop = loop;
  video.play();
}

function playEnemyAttackVideo() {
  return new Promise(resolve => {
    const video = document.querySelector('.arena-video');
    playVideo(VIDEO_ENEMY_ATTACK, false);
    video.onended = () => {
      playVideo(VIDEO_DEFAULT, true);
      video.onended = null;
      resolve();
    };
  });
}

function showResult(win, reason) {
  const result = document.getElementById('result');
  result.classList.remove('hidden', 'win', 'lose');
  result.classList.add(win ? 'win' : 'lose');
  document.getElementById('resultText').textContent = win ? '🏆 ¡VICTORIA!' : '💀 DERROTA';
  document.getElementById('resultDesc').textContent = reason;
}
