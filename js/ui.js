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
    const isBonusCard = c.id === bonusCard;
    const isBonusAvailable = isBonusCard && !game.bonusUsed && game.turn <= 3;
    const cls = ['card'];
    if (!c.isHeal) cls.push('attack');
    if (isUsed) cls.push('used');
    if (game.isProcessing) cls.push('disabled');
    if (isBonusCard) cls.push('bonus-match');
    if (c.isHeal) cls.push('heal');

    return `
      <div class="${cls.join(' ')}" onclick="playCard('${c.id}')" data-id="${c.id}">
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

function animationLoop(timestamp) {
  for (const anim of activeAnimators) {
    anim.tick(timestamp);
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
      if (this.current >= this.bitmaps.length - 1 && this.direction === 1) {
        this.current = this.bitmaps.length - 1;
        this.direction = 0; // pause at peak
        this.peakUntil = timestamp + (this.peakHold || 0);
      } else if (this.direction === 0) {
        // Holding at peak frame
        if (timestamp >= this.peakUntil) {
          this.direction = -1;
          this.current = this.bitmaps.length - 7;
        }
        this._draw();
        return;
      } else if (this.current <= this.reverseStop && this.direction === -1) {
        this.current = this.reverseStop;
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

  _drawFrame(index) {
    if (!this.ready) return;
    const bmp = this.bitmaps[index];
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

  // Play forward then reverse (ping-pong once)
  // reverseFrames = how many frames on the way back (default: all)
  // holdMs = pause at peak frame before reversing (default: 0)
  playOncePingPong(reverseFrames, holdMs = 0) {
    return new Promise(resolve => {
      this.stop();
      this.mode = 'oncePingPong';
      this.direction = 1;
      this.current = 0;
      this.lastTime = 0;
      this.onceResolve = resolve;
      this.peakHold = holdMs;
      this.peakUntil = 0;
      this.reverseStop = reverseFrames !== undefined
        ? this.bitmaps.length - 1 - reverseFrames
        : 0;
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
const bgAnim          = new FrameAnimator($('bgCanvas'),   'assets/frames/bg',           59,  24);
const userDefaultAnim = new FrameAnimator($('userCanvas'),  'assets/frames/user-default',  68,  30);
const userAttackAnim  = new FrameAnimator($('userCanvas'),  'assets/frames/user-attack',   75,  36);
const userAttackRevAnim = new FrameAnimator($('userCanvas'), 'assets/frames/user-attack-reverse', 22, 36);
const userDefenseAnim = new FrameAnimator($('userCanvas'),  'assets/frames/user-defense',  75,  30);
const botDefaultAnim  = new FrameAnimator($('botCanvas'),   'assets/frames/bot-default',   75,  30);
const botAttackAnim   = new FrameAnimator($('botCanvas'),   'assets/frames/bot-attack',   104,  42);
const botDefenseAnim  = new FrameAnimator($('botCanvas'),   'assets/frames/bot-defense',   75,  30);
const userRockAttackAnim = new FrameAnimator($('userCanvas'), 'assets/frames/user-rock-attack', 51, 36);

// Preload all frames with progress tracking
const allAnimators = [bgAnim, userDefaultAnim, userAttackAnim, userAttackRevAnim, userDefenseAnim, botDefaultAnim, botAttackAnim, botDefenseAnim, userRockAttackAnim];
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

function blinkDamage(canvas) {
  return new Promise(resolve => {
    canvas.classList.add('damage-blink');
    canvas.addEventListener('animationend', () => {
      canvas.classList.remove('damage-blink');
      resolve();
    }, { once: true });
  });
}

function arenaShake() {
  const arena = document.querySelector('.arena');
  arena.classList.add('arena-shake');
  arena.addEventListener('animationend', () => {
    arena.classList.remove('arena-shake');
  }, { once: true });
}

function arenaLightning() {
  const arena = document.querySelector('.arena');
  arena.classList.remove('arena-lightning');
  void arena.offsetWidth; // force reflow to restart animation
  arena.classList.add('arena-lightning');
  // Use setTimeout (1.8s matches CSS duration) — animationend would
  // fire early from child animations bubbling up (e.g. damage-blink)
  setTimeout(() => arena.classList.remove('arena-lightning'), 1800);
}

// Player attacks (forward + reverse sprite) + bot defends
// isBonus = true → use rock attack sprite, no arena shake
function playPlayerAttack(killingBlow, isBonus) {
  return new Promise(async resolve => {
    userDefaultAnim.stop();

    let attack;
    if (isBonus) {
      // Rock Invocation — play rock sprite + lightning storm
      setTimeout(arenaLightning, 300);
      attack = userRockAttackAnim.playOnce();
    } else {
      // Normal attack — regular sprite + arena shake
      setTimeout(arenaShake, 750);
      attack = (async () => {
        await userAttackAnim.playOnce();
        await userAttackRevAnim.playOnce();
      })();
    }

    const defenseDelay = isBonus ? 800 : 1050;
    const defense = (async () => {
      await delay(defenseDelay);
      botDefaultAnim.stop();
      botDefenseAnim._drawFrame(0);
      await blinkDamage($('botCanvas'));
      if (killingBlow) {
        $('botCanvas').classList.add('defeated');
      } else {
        await botDefenseAnim.playOnce();
      }
    })();

    await Promise.all([attack, defense]);
    userDefaultAnim.startLoop();
    if (!killingBlow) botDefaultAnim.startLoop();
    resolve();
  });
}

// Bot attacks (z-front) → 1s later player defends
function playEnemyAttack(killingBlow) {
  const botCanvas = $('botCanvas');
  return new Promise(async resolve => {
    botCanvas.classList.add('z-front', 'bot-attack-dip');
    botDefaultAnim.stop();
    const attack = botAttackAnim.playOnce();

    const defense = (async () => {
      await delay(1700);
      userDefaultAnim.stop();
      userDefenseAnim._drawFrame(0);
      await blinkDamage($('userCanvas'));
      if (killingBlow) {
        $('userCanvas').classList.add('defeated');
      } else {
        await userDefenseAnim.playOnce();
      }
    })();

    await Promise.all([attack, defense]);
    botCanvas.classList.remove('z-front', 'bot-attack-dip');
    botDefaultAnim.startLoop();
    if (!killingBlow) userDefaultAnim.startLoop();
    resolve();
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
