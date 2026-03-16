// ============================================================
// UI — DOM updates, card rendering, animations
// ============================================================

const $ = id => document.getElementById(id);

// --- Global mute ---
let _muted = false;
function playSfx(src, volume = 0.25, rate = 1) {
  if (_muted) return;
  const s = new Audio(src);
  s.volume = volume;
  s.playbackRate = rate;
  s.play().catch(() => {});
}

// --- Video music (intro & outro) ---
const _introMusic = new Audio('assets/intro-music.mp3?v=2');
_introMusic.loop = true;
_introMusic.volume = 0.08;
const _outroMusic = new Audio('assets/outro-music.mp3?v=6');
_outroMusic.loop = true;
_outroMusic.volume = 0.08;
let _activeVideoMusic = null;

function startVideoMusic(track) {
  if (_activeVideoMusic) { _activeVideoMusic.pause(); _activeVideoMusic.currentTime = 0; }
  _activeVideoMusic = track;
  track.currentTime = 0;
  track.muted = _muted;
  track.play().catch(() => {});
}
function stopVideoMusic() {
  if (_activeVideoMusic) { _activeVideoMusic.pause(); _activeVideoMusic.currentTime = 0; _activeVideoMusic = null; }
}

$('muteBtn').addEventListener('click', () => {
  _muted = !_muted;
  $('muteBtn').textContent = _muted ? '🔇' : '🔊';
  if (window._bgMusic) window._bgMusic.muted = _muted;
  if (_activeVideoMusic) _activeVideoMusic.muted = _muted;
});

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
          : `<span class="card-damage">Damage: <strong>${c.baseDmg}p</strong></span>
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
  playSfx('assets/Heavy.mp3');
  setTimeout(() => el.classList.add('hidden'), 1200);
}

function showResult(win, reason) {
  if (win) playSfx('assets/you-win.mp3');
  else playSfx('assets/you-lose.mp3', 0.4);
  const showDelay = win ? 400 : 700;
  setTimeout(() => {
    const el = $('result');
    el.classList.remove('hidden', 'win', 'lose');
    el.classList.add(win ? 'win' : 'lose');
    const img = win ? 'assets/you-win.png' : 'assets/you-lose.png';
    $('resultText').innerHTML = `<img src="${img}" alt="${win ? 'You Win!' : 'You Lose!'}" class="result-lettering">`;
    $('resultDesc').textContent = '';
    $('continueBtn').style.display = win ? '' : 'none';
  }, showDelay);
}

// --- Outro video ---
const OUTRO_PAUSE_TIME = 274 / 25; // frame 274 at 25fps ≈ 10.96s
let _outroPhase = 0; // 0=playing, 1=paused at frame 296, 2=playing rest, 3=ended

let _outroRaf = 0;
function pollOutroPause() {
  if (_outroPhase === 0 && $('outroVideo').currentTime >= OUTRO_PAUSE_TIME) {
    _outroPhase = 1;
    $('outroVideo').pause();
    $('outroContinueBtn').style.display = '';
    return;
  }
  if (_outroPhase === 0) _outroRaf = requestAnimationFrame(pollOutroPause);
}

$('continueBtn').addEventListener('click', () => {
  $('result').classList.add('hidden');
  if (window._bgMusic) { window._bgMusic.pause(); window._bgMusic.currentTime = 0; }
  startVideoMusic(_outroMusic);
  const outro = $('videoOutro');
  outro.classList.remove('hidden');
  const video = $('outroVideo');
  video.playbackRate = 1;
  video.currentTime = 0;
  _outroPhase = 0;
  $('outroContinueBtn').style.display = 'none';
  $('outroEndScreen').style.display = 'none';
  video.play().catch(() => {});
  _outroRaf = requestAnimationFrame(pollOutroPause);
});

$('outroVideo').addEventListener('ended', () => {
  _outroPhase = 3;
  // music keeps playing until Play Again (reload stops it)
  $('outroContinueBtn').style.display = 'none';
  $('outroEndScreen').style.display = '';
});

$('outroContinueBtn').addEventListener('click', () => {
  $('outroContinueBtn').style.display = 'none';
  if (_outroPhase === 1) {
    _outroPhase = 2;
    const v = $('outroVideo');
    v.currentTime = v.currentTime + (5 / 25); // skip 5 frames at 25fps
    v.play().catch(() => {});
  } else {
    window.location.reload();
  }
});

// ============================================================
// Global animation loop — single rAF for all animators
// ============================================================
const activeAnimators = new Set();
let _rafId = 0;

function animationLoop(timestamp) {
  for (const anim of activeAnimators) {
    anim.tick(timestamp);
  }
  if (activeAnimators.size > 0) {
    _rafId = requestAnimationFrame(animationLoop);
  } else {
    _rafId = 0;
  }
}

function _startLoop() {
  if (!_rafId) _rafId = requestAnimationFrame(animationLoop);
}

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

    // Fire frame triggers (check range to handle frame skipping)
    if (this.frameTriggers && this._firedTriggers) {
      for (const [frame, cb] of this.frameTriggers) {
        if (!this._firedTriggers.has(frame) && frame <= this.current) {
          this._firedTriggers.add(frame);
          cb();
        }
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
    activeAnimators.add(this); _startLoop();
  }

  startPingPong() {
    this.stop();
    this.mode = 'pingpong';
    this.direction = 1;
    this.current = 0;
    this.lastTime = 0;
    activeAnimators.add(this); _startLoop();
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
      activeAnimators.add(this); _startLoop();
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
      activeAnimators.add(this); _startLoop();
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
      activeAnimators.add(this); _startLoop();
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
const attackSfx = () => playSfx('assets/attack.mp3');
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

// --- Title screen ---
$('startGameBtn').addEventListener('click', () => {
  $('titleScreen').classList.add('hidden');
  $('chapterSelect').classList.remove('hidden');
});

// --- Chapter Selection Grid ---
const UNLOCKED_CHAPTERS = new Set([1]); // chapter numbers that are unlocked

$('chapterGrid').addEventListener('click', (e) => {
  const card = e.target.closest('.chapter-card');
  if (!card) return;
  const ch = parseInt(card.dataset.chapter, 10);
  if (!UNLOCKED_CHAPTERS.has(ch)) return;
  $('chapterSelect').classList.add('hidden');
  $('videoIntro').classList.remove('hidden');
  $('introVideo').play().catch(() => {});
  startVideoMusic(_introMusic);
  _introRaf = requestAnimationFrame(pollIntro);
});

// --- Video intro ---

function endVideoIntro() {
  const vid = $('videoIntro');
  if (!vid || vid.classList.contains('hidden')) return;
  const video = $('introVideo');
  video.pause();
  stopVideoMusic();
  vid.classList.add('hidden');
  $('loadingScreen').classList.remove('hidden');
  startPreloading();
}
$('introVideo').playbackRate = 1;
const INTRO_SWAP_TIME = 250 / 25; // frame 250 — swap Skip→Continue early
const INTRO_PAUSE_TIME = 325 / 25; // frame 325 at 25fps = 13s (viñetas fully visible)
const INTRO_BATTLE_BTN_TIME = 450 / 25; // frame 450 — show "Go to battle!" button (video keeps playing)
let _introPhase = 0; // 0=playing part1, 1=paused at frame 350, 2=playing part2, 3=ended
let _introSwapped = false;
let _introBattleBtnShown = false;
let _introRaf = 0;
function pollIntro() {
  const t = $('introVideo').currentTime;
  if (_introPhase === 0 && !_introSwapped && t >= INTRO_SWAP_TIME) {
    _introSwapped = true;
    $('skipIntroBtn').style.display = 'none';
    $('introContinueBtn').style.display = '';
  }
  if (_introPhase === 0 && t >= INTRO_PAUSE_TIME) {
    _introPhase = 1;
    $('introVideo').pause();
    return;
  }
  if (_introPhase === 2 && !_introBattleBtnShown && t >= INTRO_BATTLE_BTN_TIME) {
    _introBattleBtnShown = true;
    $('introContinueBtn').textContent = 'Go to battle!';
    $('introContinueBtn').style.display = '';
    // video keeps playing — no pause
  }
  if (_introPhase === 0 || _introPhase === 2) _introRaf = requestAnimationFrame(pollIntro);
}
$('introVideo').addEventListener('ended', () => {
  _introPhase = 3;
  if (!_introBattleBtnShown) {
    $('introContinueBtn').textContent = 'Go to battle!';
    $('introContinueBtn').style.display = '';
  }
});
$('introContinueBtn').addEventListener('click', () => {
  $('introContinueBtn').style.display = 'none';
  if (_introPhase === 0 || _introPhase === 1) {
    // Skip to second part — jump past frame 350 pause
    if (_introMusic.paused) startVideoMusic(_introMusic);
    _introPhase = 2;
    const v = $('introVideo');
    v.currentTime = INTRO_PAUSE_TIME + (5 / 25); // jump to frame 355
    v.play().catch(() => {});
    _introRaf = requestAnimationFrame(pollIntro); // poll for end pause
  } else {
    // Video ended: go to loading screen
    endVideoIntro();
  }
});
$('skipIntroBtn').addEventListener('click', endVideoIntro);

const loadingBar = $('loadingBar');
const loadingFill = document.createElement('div');
loadingFill.className = 'loading-bar-fill';
loadingBar.appendChild(loadingFill);

function onFrameLoaded() {
  loadedFrames++;
  const pct = (loadedFrames / totalFrames) * 100;
  loadingFill.style.width = `${pct}%`;
}

let _preloadResolve;
const allPreloaded = new Promise(r => { _preloadResolve = r; });

function startPreloading() {
Promise.all(
  allAnimators.map(a => a.preload(onFrameLoaded))
).then(() => bgAnim.bakeFilter()).then(() => {
  const screen = $('loadingScreen');
  screen.classList.add('fade-out');
  setTimeout(() => screen.remove(), 500);

  // Show intro overlay — wait for user to click "Ir a la batalla"
  $('startBattleBtn').addEventListener('click', () => {
    $('introOverlay').classList.add('hidden');

    // Background music — very low volume, looped
    const bgMusic = new Audio('assets/music.mp3');
    bgMusic.loop = true;
    bgMusic.volume = 0.08;
    bgMusic.play().catch(() => {});
    window._bgMusic = bgMusic;
  });
  _preloadResolve();
});
} // end startPreloading

function startIdleAnimations() {
  bgAnim.loopPause = 120;
  bgAnim.startPingPong();
  userDefaultAnim.startLoop();
  botDefaultAnim.startLoop();
}

// ============================================================
// Combat animations
// ============================================================

function blinkDamage(canvas, variant) {
  const animName = variant === 'lightning' ? 'hitFlashLightning'
                 : variant === 'beer'      ? 'hitFlashBeer'
                 : 'hitFlash';
  return new Promise(resolve => {
    canvas.style.animation = `${animName} 0.72s steps(1)`;
    function onEnd(e) {
      if (e.animationName !== animName) return;
      canvas.removeEventListener('animationend', onEnd);
      canvas.style.animation = '';
      canvas.style.filter = '';
      resolve();
    }
    canvas.addEventListener('animationend', onEnd);
  });
}

const _arena = document.querySelector('.arena');

function arenaShake() {
  _arena.classList.add('arena-shake');
  setTimeout(() => _arena.classList.remove('arena-shake'), 2020);
}

function arenaLightning() {
  _arena.classList.remove('arena-lightning');
  void _arena.offsetWidth; // force reflow to restart animation
  _arena.classList.add('arena-lightning');
  setTimeout(() => _arena.classList.remove('arena-lightning'), 1800);
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
            playSfx('assets/rock-invocation.mp3', 0.25, 2.0);
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

    const defenseDelay = isBonus ? 550 : 750;
    const defense = (async () => {
      await delay(defenseDelay);
      botDefaultAnim.stop();
      botDefenseAnim._drawFrame(0);
      setTimeout(() => playSfx('assets/defense-bot-blink.mp3', 0.15, 2.0), 200);
      await blinkDamage($('botCanvas'), isBonus ? 'lightning' : null);
      if (onHit) onHit();
      if (killingBlow) {
        $('botCanvas').classList.add('defeated');
      } else {
        playSfx('assets/defense-bot.mp3');
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
    setTimeout(() => playSfx('assets/beer-attack.mp3', 0.15, 2.0), 600);
    const attack = botAttackAnim.playOnce();

    const defense = (async () => {
      await delay(1050);
      userDefaultAnim.stop();
      userDefenseAnim._drawFrame(0);
      setTimeout(() => playSfx('assets/mc-defense.mp3', 0.25, 1.5), 200);
      await blinkDamage($('userCanvas'), 'beer');
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
    playSfx('assets/Burbuja.mp3');
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
