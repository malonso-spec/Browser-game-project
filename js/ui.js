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
  if (!log) return;
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

// --- Seamless background video loop ---
(function initSeamlessLoop() {
  const REWIND_MARGIN = 0.15;
  const bg = document.getElementById('videoBg');
  if (!bg) return;
  bg.loop = false;
  bg.addEventListener('timeupdate', () => {
    if (bg.duration && bg.currentTime >= bg.duration - REWIND_MARGIN) {
      bg.currentTime = 0;
    }
  });
})();

// --- Frame Animator ---
class FrameAnimator {
  constructor(imgEl, folder, count, fps) {
    this.imgEl = imgEl;
    this.fps = fps;
    this.frames = [];
    this.intervalId = null;
    this.current = 0;
    // Preload all frames
    for (let i = 0; i < count; i++) {
      const img = new Image();
      img.src = `${folder}/frame_${String(i).padStart(5, '0')}.png`;
      this.frames.push(img);
    }
  }

  startLoop() {
    this.stopLoop();
    this.current = 0;
    this.imgEl.src = this.frames[0].src;
    this.intervalId = setInterval(() => {
      this.current = (this.current + 1) % this.frames.length;
      this.imgEl.src = this.frames[this.current].src;
    }, 1000 / this.fps);
  }

  stopLoop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  playOnce() {
    return new Promise(resolve => {
      this.stopLoop();
      this.current = 0;
      this.imgEl.src = this.frames[0].src;
      this.intervalId = setInterval(() => {
        this.current++;
        if (this.current >= this.frames.length) {
          this.stopLoop();
          resolve();
          return;
        }
        this.imgEl.src = this.frames[this.current].src;
      }, 1000 / this.fps);
    });
  }
}

// Create animators
const botSprite = document.getElementById('botSprite');
const userSprite = document.getElementById('userSprite');
const botDefaultAnim = new FrameAnimator(botSprite, 'assets/frames/bot-default', 75, 24);
const userDefaultAnim = new FrameAnimator(userSprite, 'assets/frames/user-default', 75, 24);
const botAttackAnim = new FrameAnimator(botSprite, 'assets/frames/bot-attack', 104, 24);
const userDefenseAnim = new FrameAnimator(userSprite, 'assets/frames/user-defense', 75, 24);
const botDefenseAnim = new FrameAnimator(botSprite, 'assets/frames/bot-defense', 75, 24);

// Start idle loops
function startIdleAnimations() {
  botDefaultAnim.startLoop();
  userDefaultAnim.startLoop();
}
startIdleAnimations();

function playVideo() {
  // kept for compatibility with game.js init() call
}

// Bot attacks → 3s later main character defends
function playEnemyAttackVideo() {
  return new Promise(async resolve => {
    botDefaultAnim.stopLoop();
    // Start bot attack + schedule defense 3s later
    const attackDone = botAttackAnim.playOnce();
    const defenseDone = new Promise(async r => {
      await new Promise(wait => setTimeout(wait, 3000));
      userDefaultAnim.stopLoop();
      await userDefenseAnim.playOnce();
      r();
    });
    // Wait for both to finish
    await Promise.all([attackDone, defenseDone]);
    botDefaultAnim.startLoop();
    userDefaultAnim.startLoop();
    resolve();
  });
}

// Main character attacks (future) + bot defends simultaneously
function playPlayerAttackAnimation() {
  return new Promise(async resolve => {
    // TODO: main character attack anim when available
    // Wait 3s to simulate attack before bot reacts
    await new Promise(r => setTimeout(r, 3000));
    botDefaultAnim.stopLoop();
    await botDefenseAnim.playOnce();
    // Defense done → resume idle
    botDefaultAnim.startLoop();
    resolve();
  });
}

function showResult(win, reason) {
  const result = document.getElementById('result');
  result.classList.remove('hidden', 'win', 'lose');
  result.classList.add(win ? 'win' : 'lose');
  document.getElementById('resultText').textContent = win ? '🏆 ¡VICTORIA!' : '💀 DERROTA';
  document.getElementById('resultDesc').textContent = reason;
}
