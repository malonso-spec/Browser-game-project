// ============================================================
// UI — DOM updates, card rendering, animations
// ============================================================

const $ = id => document.getElementById(id);

// --- UI updates ---
function updateHearts(containerId, hp) {
  const container = $(containerId);
  const pct = Math.max(0, Math.min(100, hp));
  const fill = container.querySelector('.hp-bar-fill');
  const heart = container.querySelector('.hp-heart');
  fill.style.width = pct + '%';
  if (containerId === 'enemyHearts') {
    heart.style.left = (100 - pct) + '%';
  } else {
    heart.style.left = pct + '%';
  }
}

function updateUI(playerHP, enemyHP, turn, usedCards) {
  updateHearts('playerHearts', playerHP);
  updateHearts('enemyHearts', enemyHP);
  $('turnCount').textContent = turn;
  $('currentTurn').textContent = turn;
  $('cardsLeft').textContent = 5 - usedCards.length;
}

let cardsDealt = false;

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
    if (isBonusCard) {
      cls.push('bonus-match');
      if (game.turn >= 2) cls.push(`turn-${game.turn}`);
    }
    if (c.isHeal) cls.push('heal');
    if (cardsDealt) cls.push('dealt');

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

function dealCards() {
  cardsDealt = false;
  const cards = $('cards').querySelectorAll('.card');
  cards.forEach((card, i) => {
    setTimeout(() => {
      card.classList.add('dealt');
    }, i * 150);
  });
  setTimeout(() => { cardsDealt = true; }, cards.length * 150);
}

function shake(el) {
  if (!el) return;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 400);
}

function showCritAlert() {
  const el = $('critAlert');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 1200);
}

function showResult(win, reason) {
  const el = $('result');
  el.classList.remove('hidden', 'win', 'lose');
  el.classList.add(win ? 'win' : 'lose');
  const img = win ? 'assets/you-win.png' : 'assets/you-lose.png';
  $('resultText').innerHTML = `<img src="${img}" alt="${win ? 'You Win!' : 'You Lose!'}" class="result-lettering">`;
  $('resultDesc').textContent = '';
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
    this.loopPause = 0;       // ms to pause between loop cycles
    this._pauseUntil = 0;
    this.frameTriggers = null; // Map<frameIndex, callback> — fires once per playOnce
    this._firedTriggers = null;
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

  // Bake drawFilter into bitmaps so runtime draws need no ctx.filter
  async bakeFilter() {
    if (!this.drawFilter || !this.ready) return;
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const ctx = c.getContext('2d');
    ctx.filter = this.drawFilter;
    for (let i = 0; i < this.bitmaps.length; i++) {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(this.bitmaps[i], 0, 0);
      this.bitmaps[i].close();
      this.bitmaps[i] = await createImageBitmap(c);
    }
    this.drawFilter = null;
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

    // Advance by multiple frames if FPS > display refresh rate
    const steps = Math.floor(delta / this.interval);
    this.lastTime = timestamp - (delta % this.interval);
    this.current += this.direction * steps;

    if (this.mode === 'pingpong') {
      if (this.current >= this.bitmaps.length - 1) {
        this.current = this.bitmaps.length - 1;
        if (this.loopPause > 0 && !this._pauseUntil) {
          this._pauseUntil = timestamp + this.loopPause;
          this._draw();
          return;
        } else if (this._pauseUntil && timestamp < this._pauseUntil) {
          this._draw();
          return;
        }
        this._pauseUntil = 0;
        this.direction = -1;
      } else if (this.current <= 0) {
        this.current = 0;
        if (this.loopPause > 0 && !this._pauseUntil) {
          this._pauseUntil = timestamp + this.loopPause;
          this._draw();
          return;
        } else if (this._pauseUntil && timestamp < this._pauseUntil) {
          this._draw();
          return;
        }
        this._pauseUntil = 0;
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
      if (this.current >= this.bitmaps.length) {
        if (this.loopPause > 0) {
          if (!this._pauseUntil) {
            this.current = this.bitmaps.length - 1;
            this._pauseUntil = timestamp + this.loopPause;
            return;
          } else if (timestamp < this._pauseUntil) {
            this.current = this.bitmaps.length - 1;
            return;
          } else {
            this._pauseUntil = 0;
            this.current = 0;
          }
        } else {
          this.current %= this.bitmaps.length;
        }
      }
    }

    // Fire frame triggers
    if (this.frameTriggers && this._firedTriggers) {
      const cb = this.frameTriggers.get(this.current);
      if (cb && !this._firedTriggers.has(this.current)) {
        this._firedTriggers.add(this.current);
        cb();
      }
    }

    this._draw();
  }

  _draw() {
    this._drawFrame(this.current);
  }

  _drawFrame(index) {
    if (!this.ready) return;
    const bmp = this.bitmaps[index];
    if (!bmp) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.drawFilter) ctx.filter = this.drawFilter;
    ctx.drawImage(bmp, 0, 0);
    if (this.drawFilter) ctx.filter = 'none';
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
      this._firedTriggers = this.frameTriggers ? new Set() : null;
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
bgAnim.drawFilter = 'brightness(0.8) contrast(1.2)';
const userDefaultAnim = new FrameAnimator($('userCanvas'),  'assets/frames/user-default',  68,  30);
userDefaultAnim.loopPause = 64;
const userAttackAnim  = new FrameAnimator($('userCanvas'),  'assets/frames/user-attack',   75,  40);
const attackSfx = () => { const s = new Audio('assets/attack.mp3'); s.volume = 0.25; s.play().catch(() => {}); };
userAttackAnim.frameTriggers = new Map([[23, attackSfx], [71, attackSfx]]);
const userAttackRevAnim = new FrameAnimator($('userCanvas'), 'assets/frames/user-attack-reverse', 22, 40);
const userDefenseAnim = new FrameAnimator($('userCanvas'),  'assets/frames/user-defense',  75,  40);
const botDefaultAnim  = new FrameAnimator($('botCanvas'),   'assets/frames/bot-default',   75,  30);
const botAttackAnim   = new FrameAnimator($('botCanvas'),   'assets/frames/bot-attack',   104,  40);
const botDefenseAnim  = new FrameAnimator($('botCanvas'),   'assets/frames/bot-defense',   75,  48);
const userRockAttackAnim = new FrameAnimator($('userCanvas'), 'assets/frames/user-rock-attack', 51, 40);
const lightningAnim = new FrameAnimator($('lightningCanvas'), 'assets/frames/lightning', 51, 40);
const userHealAnim = new FrameAnimator($('userCanvas'), 'assets/frames/user-heal', 51, 64);

// Preload all frames with progress tracking
const allAnimators = [bgAnim, userDefaultAnim, userAttackAnim, userAttackRevAnim, userDefenseAnim, botDefaultAnim, botAttackAnim, botDefenseAnim, userRockAttackAnim, lightningAnim, userHealAnim];
const totalFrames = allAnimators.reduce((sum, a) => sum + a.count, 0);
let loadedFrames = 0;

const loadingBar = $('loadingBar');
const loadingFill = document.createElement('div');
loadingFill.className = 'loading-bar-fill';
loadingBar.appendChild(loadingFill);

function onFrameLoaded() {
  loadedFrames++;
  const pct = (loadedFrames / totalFrames) * 100;
  loadingFill.style.width = `${pct}%`;
}

const allPreloaded = Promise.all(
  allAnimators.map(a => a.preload(onFrameLoaded))
).then(() => bgAnim.bakeFilter()).then(() => {
  const screen = $('loadingScreen');
  screen.classList.add('fade-out');
  setTimeout(() => screen.remove(), 500);

  // Background music — very low volume, looped
  const bgMusic = new Audio('assets/music.mp3');
  bgMusic.loop = true;
  bgMusic.volume = 0.02;
  bgMusic.play().catch(() => {
    // Autoplay blocked — start on first user click
    const resume = () => { bgMusic.play().catch(() => {}); document.removeEventListener('click', resume); };
    document.addEventListener('click', resume);
  });
  window._bgMusic = bgMusic;
});

function startIdleAnimations() {
  bgAnim.loopPause = 120;
  bgAnim.startPingPong();
  userDefaultAnim.startLoop();
  botDefaultAnim.startLoop();
}

// ============================================================
// Combat animations
// ============================================================

function blinkDamage(canvas) {
  return new Promise(resolve => {
    canvas.style.animation = 'hitFlash 0.72s steps(1)';
    function onEnd(e) {
      if (e.animationName !== 'hitFlash') return;
      canvas.removeEventListener('animationend', onEnd);
      canvas.style.animation = '';
      resolve();
    }
    canvas.addEventListener('animationend', onEnd);
  });
}

function arenaShake() {
  const arena = document.querySelector('.arena');
  arena.classList.add('arena-shake');
  // Use setTimeout (2.02s matches CSS duration) — animationend would
  // fire early from child animations bubbling up (e.g. hitFlash)
  setTimeout(() => arena.classList.remove('arena-shake'), 2020);
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
function playPlayerAttack(killingBlow, isBonus, onHit) {
  return new Promise(async resolve => {
    userDefaultAnim.stop();

    let attack;
    if (isBonus) {
      // Rock Invocation — play rock sprite + lightning bolt sprite
      setTimeout(arenaLightning, 300);
      const lc = $('lightningCanvas');
      lc.style.display = 'block';
      attack = (async () => {
        await Promise.all([
          userRockAttackAnim.playOnce(),
          (async () => {
            await delay(200);
            const rockSfx = new Audio('assets/rock-invocation.mp3');
            rockSfx.volume = 0.25;
            rockSfx.play().catch(() => {});
            await lightningAnim.playOnce();
          })()
        ]);
        lc.style.display = 'none';
      })();
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
      if (onHit) onHit();
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
function playEnemyAttack(killingBlow, onHit) {
  const botCanvas = $('botCanvas');
  return new Promise(async resolve => {
    botCanvas.classList.add('z-front');
    botDefaultAnim.stop();
    const attack = botAttackAnim.playOnce();

    const defense = (async () => {
      await delay(1400);
      userDefaultAnim.stop();
      userDefenseAnim._drawFrame(0);
      await blinkDamage($('userCanvas'));
      if (onHit) onHit();
      if (killingBlow) {
        $('userCanvas').classList.add('defeated');
      } else {
        await userDefenseAnim.playOnce();
      }
    })();

    await Promise.all([attack, defense]);
    botCanvas.classList.remove('z-front');
    botDefaultAnim.startLoop();
    if (!killingBlow) userDefaultAnim.startLoop();
    resolve();
  });
}

// Player heal — bubble animation + shield glow
function playHealAnimation() {
  return new Promise(async resolve => {
    const canvas = $('userCanvas');
    canvas.classList.add('z-front');
    userDefaultAnim.stop();
    const bubbleSfx = new Audio('assets/Burbuja.mp3');
    bubbleSfx.volume = 0.25;
    bubbleSfx.play().catch(() => {});
    await userHealAnim.playOnce();
    canvas.classList.remove('z-front');
    canvas.classList.add('shield-glow');
    userDefaultAnim.startLoop();
    resolve();
  });
}

function removeShieldGlow() {
  $('userCanvas').classList.remove('shield-glow');
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
