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

// Default video always plays in background; attack video is layered on top via z-index
// Seamless loop for default video
(function initSeamlessLoop() {
  const REWIND_MARGIN = 0.15;
  const defaultVideo = document.getElementById('videoDefault');
  if (!defaultVideo) return;
  defaultVideo.loop = false;
  defaultVideo.addEventListener('timeupdate', () => {
    if (defaultVideo.duration && defaultVideo.currentTime >= defaultVideo.duration - REWIND_MARGIN) {
      defaultVideo.currentTime = 0;
    }
  });
})();

function playVideo(src) {
  const attackVideo = document.getElementById('videoAttack');
  if (src === VIDEO_DEFAULT) {
    attackVideo.classList.remove('active');
  } else {
    attackVideo.currentTime = 0;
    attackVideo.play();
    attackVideo.classList.add('active');
  }
}

function playEnemyAttackVideo() {
  return new Promise(resolve => {
    const attackVideo = document.getElementById('videoAttack');
    const EARLY_CUT = 0.15; // fade out before the last frames to avoid black flash
    attackVideo.currentTime = 0;
    attackVideo.play();
    attackVideo.classList.add('active');
    function onTime() {
      if (attackVideo.duration && attackVideo.currentTime >= attackVideo.duration - EARLY_CUT) {
        attackVideo.removeEventListener('timeupdate', onTime);
        attackVideo.classList.remove('active');
        attackVideo.pause();
        setTimeout(resolve, 220);
      }
    }
    attackVideo.addEventListener('timeupdate', onTime);
  });
}

function showResult(win, reason) {
  const result = document.getElementById('result');
  result.classList.remove('hidden', 'win', 'lose');
  result.classList.add(win ? 'win' : 'lose');
  document.getElementById('resultText').textContent = win ? '🏆 ¡VICTORIA!' : '💀 DERROTA';
  document.getElementById('resultDesc').textContent = reason;
}
