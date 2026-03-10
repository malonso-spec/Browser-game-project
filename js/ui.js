// ============================================================
// UI — DOM updates, card rendering, animations
// ============================================================

const $ = id => document.getElementById(id);

// --- UI updates ---
function updateUI(playerHP, enemyHP, turn, usedCards) {
  $('playerHP').textContent = playerHP;
  $('enemyHP').textContent = enemyHP;
  $('playerHealthBar').style.width = playerHP + '%';
  $('enemyHealthBar').style.width = enemyHP + '%';
  $('turnCount').textContent = turn;
  $('currentTurn').textContent = turn;
  $('cardsLeft').textContent = 5 - usedCards.length;
}

function renderCards(game) {
  const container = $('cards');
  const bonusCard = STATE_CARD_MAP[game.enemyState];

  container.innerHTML = CARDS.map(c => {
    const isUsed = game.usedCards.includes(c.id);
    const isBonusMatch = c.id === bonusCard && !game.bonusUsed && game.turn <= 3;
    const cls = ['card'];
    if (isUsed) cls.push('used');
    if (game.isProcessing) cls.push('disabled');
    if (isBonusMatch && !isUsed) cls.push('bonus-match');
    if (c.isHeal) cls.push('heal');

    return `
      <div class="${cls.join(' ')}" onclick="playCard('${c.id}')" data-id="${c.id}">
        <span class="card-letter">${c.id}</span>
        <span class="card-icon">${c.icon}</span>
        <span class="card-name">${c.name}</span>
        ${c.isHeal
          ? `<span class="card-damage"><strong>+${c.heal}p</strong> HP</span>`
          : `<span class="card-damage">Daño: <strong>${c.baseDmg}p</strong></span>
             ${c.hasBonus ? `<span class="card-bonus">+Bonus si ${c.state}</span>` : ''}`
        }
      </div>`;
  }).join('');
}

function shake(el) {
  if (!el) return;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 400);
}

function showCritAlert() {
  const el = $('critAlert');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 600);
}

function showResult(win, reason) {
  const el = $('result');
  el.classList.remove('hidden', 'win', 'lose');
  el.classList.add(win ? 'win' : 'lose');
  $('resultText').textContent = win ? '🏆 ¡VICTORIA!' : '💀 DERROTA';
  $('resultDesc').textContent = reason;
}

// ============================================================
// Global animation loop — single rAF for all animators
// ============================================================
const activeAnimators = new Set();
const frameCounterEl = $('frameCounter');

function animationLoop(timestamp) {
  for (const anim of activeAnimators) {
    anim.tick(timestamp);
  }
  if (bgAnim && bgAnim.ready) {
    frameCounterEl.textContent = `BG: ${bgAnim.current}/${bgAnim.count}`;
  }
  requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

// ============================================================
// FrameAnimator — canvas + pre-decoded ImageBitmap
// ============================================================
class FrameAnimator {
  constructor(canvas, folder, count, fps) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.interval = 1000 / fps;
    this.folder = folder;
    this.count = count;
    this.bitmaps = [];       // ImageBitmap[] — pre-decoded
    this.current = 0;
    this.lastTime = 0;
    this.direction = 1;      // 1 = forward, -1 = reverse
    this.mode = 'loop';      // 'loop' | 'pingpong' | 'once'
    this.onceResolve = null;  // resolve callback for playOnce
    this.ready = false;
    this.sized = false;
  }

  // Pre-decode all frames → ImageBitmap (runs once at startup)
  preload(onFrame) {
    const promises = [];
    for (let i = 0; i < this.count; i++) {
      const src = `${this.folder}/frame_${String(i).padStart(5, '0')}.png`;
      const p = fetch(src)
        .then(r => r.blob())
        .then(blob => createImageBitmap(blob))
        .then(bmp => {
          this.bitmaps[i] = bmp;
          if (onFrame) onFrame();
        });
      promises.push(p);
    }
    return Promise.all(promises).then(() => {
      this.ready = true;
      if (this.bitmaps[0]) {
        this.canvas.width = this.bitmaps[0].width;
        this.canvas.height = this.bitmaps[0].height;
        this.sized = true;
      }
    });
  }

  // Called by the global loop every frame
  tick(timestamp) {
    if (!this.ready) return;

    if (!this.lastTime) {
      this.lastTime = timestamp;
      this._draw();
      return;
    }

    const delta = timestamp - this.lastTime;
    if (delta < this.interval) return;

    this.lastTime = timestamp - (delta % this.interval);
    this.current += this.direction;

    if (this.mode === 'pingpong') {
      if (this.current >= this.bitmaps.length - 1) {
        this.current = this.bitmaps.length - 1;
        this.direction = -1;
      } else if (this.current <= 0) {
        this.current = 0;
        this.direction = 1;
      }
    } else if (this.mode === 'oncePingPong') {
      if (this.current >= this.bitmaps.length - 1) {
        this.current = this.bitmaps.length - 1;
        this.direction = -1;
      } else if (this.current <= 0 && this.direction === -1) {
        this.current = 0;
        const resolve = this.onceResolve;
        this.stop();
        if (resolve) resolve();
        return;
      }
    } else if (this.mode === 'onceReverse') {
      if (this.current <= 0) {
        this.current = 0;
        const resolve = this.onceResolve;
        this.stop();
        if (resolve) resolve();
        return;
      }
    } else if (this.mode === 'once') {
      if (this.current >= this.bitmaps.length) {
        this.current = this.bitmaps.length - 1;
        const resolve = this.onceResolve;
        this.stop();
        if (resolve) resolve();
        return;
      }
    } else {
      // loop
      this.current %= this.bitmaps.length;
    }

    this._draw();
  }

  _draw() {
    const bmp = this.bitmaps[this.current];
    if (!bmp) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(bmp, 0, 0);
  }

  startLoop() {
    this.stop();
    this.mode = 'loop';
    this.direction = 1;
    this.current = 0;
    this.lastTime = 0;
    activeAnimators.add(this);
  }

  startPingPong() {
    this.stop();
    this.mode = 'pingpong';
    this.direction = 1;
    this.current = 0;
    this.lastTime = 0;
    activeAnimators.add(this);
  }

  playOnce() {
    return new Promise(resolve => {
      this.stop();
      this.mode = 'once';
      this.direction = 1;
      this.current = 0;
      this.lastTime = 0;
      this.onceResolve = resolve;
      activeAnimators.add(this);
    });
  }

  // Play from last frame to first (reverse once)
  playOnceReverse() {
    return new Promise(resolve => {
      this.stop();
      this.mode = 'onceReverse';
      this.direction = -1;
      this.current = this.bitmaps.length - 1;
      this.lastTime = 0;
      this.onceResolve = resolve;
      activeAnimators.add(this);
    });
  }

  // Play forward then reverse (ping-pong once), resolve when back to frame 0
  playOncePingPong() {
    return new Promise(resolve => {
      this.stop();
      this.mode = 'oncePingPong';
      this.direction = 1;
      this.current = 0;
      this.lastTime = 0;
      this.onceResolve = resolve;
      activeAnimators.add(this);
    });
  }

  stop() {
    activeAnimators.delete(this);
    this.onceResolve = null;
    this.lastTime = 0;
  }
}

// ============================================================
// Create animators
// ============================================================
const bgAnim          = new FrameAnimator($('bgCanvas'),   'assets/frames/bg',           59,  50);
const userDefaultAnim = new FrameAnimator($('userCanvas'),  'assets/frames/user-default',  75,  50);
const userAttackAnim  = new FrameAnimator($('userCanvas'),  'assets/frames/user-attack',   75,  50);
const userDefenseAnim = new FrameAnimator($('userCanvas'),  'assets/frames/user-defense',  75,  50);
const botDefaultAnim  = new FrameAnimator($('botCanvas'),   'assets/frames/bot-default',   75,  50);
const botAttackAnim   = new FrameAnimator($('botCanvas'),   'assets/frames/bot-attack',   104,  50);
const botDefenseAnim  = new FrameAnimator($('botCanvas'),   'assets/frames/bot-defense',   75,  50);

// Preload all frames with progress tracking
const allAnimators = [bgAnim, userDefaultAnim, userAttackAnim, userDefenseAnim, botDefaultAnim, botAttackAnim, botDefenseAnim];
const totalFrames = allAnimators.reduce((sum, a) => sum + a.count, 0);
let loadedFrames = 0;

const loadingBar = $('loadingBar');
const loadingPercent = $('loadingPercent');

function onFrameLoaded() {
  loadedFrames++;
  const pct = Math.round((loadedFrames / totalFrames) * 100);
  loadingBar.style.width = pct + '%';
  loadingPercent.textContent = pct + '%';
}

const allPreloaded = Promise.all(
  allAnimators.map(a => a.preload(onFrameLoaded))
).then(() => {
  const screen = $('loadingScreen');
  screen.classList.add('fade-out');
  setTimeout(() => screen.remove(), 500);
});

function startIdleAnimations() {
  bgAnim.startPingPong();
  userDefaultAnim.startLoop();
  botDefaultAnim.startLoop();
}

// ============================================================
// Combat animations
// ============================================================

// Player attacks (ping-pong) + bot defends (holds last frame until attack ends)
function playPlayerAttack() {
  return new Promise(async resolve => {
    userDefaultAnim.stop();
    const attack = userAttackAnim.playOncePingPong();

    const defense = (async () => {
      await delay(1000);
      botDefaultAnim.stop();
      await botDefenseAnim.playOnce();
    })();

    await Promise.all([attack, defense]);
    userDefaultAnim.startLoop();
    botDefaultAnim.startLoop();
    resolve();
  });
}

// Bot attacks (z-front) → 1s later player defends
function playEnemyAttack() {
  const botCanvas = $('botCanvas');
  return new Promise(async resolve => {
    botCanvas.classList.add('z-front');
    botDefaultAnim.stop();
    const attack = botAttackAnim.playOnce();

    const defense = (async () => {
      await delay(2000);
      userDefaultAnim.stop();
      await userDefenseAnim.playOnce();
    })();

    await Promise.all([attack, defense]);
    botCanvas.classList.remove('z-front');
    botDefaultAnim.startLoop();
    userDefaultAnim.startLoop();
    resolve();
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
