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
  $('muteBtn').classList.toggle('muted', _muted);
  if (window._bgMusic) window._bgMusic.muted = _muted;
  if (_activeVideoMusic) _activeVideoMusic.muted = _muted;
});

// --- UI updates ---
let _healBase = -1; // HP point where heal started (-1 = no active heal)

function updateHearts(containerId, hp) {
  const container = $(containerId);
  const pct = Math.max(0, Math.min(100, hp));
  const fill = container.querySelector('.hp-bar-fill');
  const heart = container.querySelector('.hp-heart');
  const pctLabel = container.querySelector('.hp-pct');

  if (containerId === 'playerHearts' && _healBase >= 0) {
    // Blue bar = up to the heal base (or current HP if lower)
    const bluePct = Math.min(pct, _healBase);
    fill.style.width = bluePct + '%';
    // Pink bar = from heal base to current HP
    const healFill = $('playerHealFill');
    const pinkWidth = Math.max(0, pct - _healBase);
    healFill.style.left = bluePct + '%';
    healFill.style.width = pinkWidth + '%';
    // After shield hit: merge heal segment into main bar, then fade
    if (pct <= _healBase) {
      _healBase = -1;
      // Expand main bar to full current HP so it covers the heal area
      fill.style.width = pct + '%';
      fill.classList.remove('healing');
      // Fade out the heal fill smoothly
      healFill.style.transition = 'opacity 0.6s ease';
      healFill.style.opacity = '0';
    }
  } else {
    fill.style.width = pct + '%';
  }

  if (pctLabel) pctLabel.textContent = Math.round(pct) + '%';
  if (containerId === 'enemyHearts') {
    heart.style.left = (100 - pct) + '%';
  } else {
    heart.style.left = pct + '%';
  }
}

function updateUI(playerHP, enemyHP, turn) {
  updateHearts('playerHearts', playerHP);
  updateHearts('enemyHearts', enemyHP);
  $('turnCount').textContent = turn;
  $('currentTurn').textContent = turn;
}

function showHealFill(oldHP, newHP) {
  const healFill = $('playerHealFill');
  if (!healFill) return;
  _healBase = Math.max(0, Math.min(100, oldHP));
  const newPct = Math.max(0, Math.min(100, newHP));
  healFill.style.left = _healBase + '%';
  healFill.style.width = (newPct - _healBase) + '%';
  healFill.style.transition = 'none';
  healFill.style.opacity = '1';
  // Flatten inner corners so bars look joined
  const fill = $('playerHearts').querySelector('.hp-bar-fill');
  if (fill) fill.classList.add('healing');
}

let cardsDealt = false;

function renderCards(game) {
  const container = $('cards');
  const critDmg = getCritDmg();

  // Card background images (transparent PNG)
  const cardBg = {
    attack: 'assets/cards/stunning-dance.png',
    crit: 'assets/cards/rock-invocation.png',
    heal: 'assets/cards/bubble-gum.png',
    food: 'assets/cards/campero-boost.png'
  };

  container.innerHTML = CARDS.map(c => {
    const available = isCardAvailable(c.id);
    const cls = ['card'];

    if (c.type === 'attack') cls.push('attack');
    if (c.type === 'crit') {
      cls.push('crit');
      cls.push('charge-' + (game.critCyclePos + 1)); // charge-1 (30), charge-2 (40), charge-3 (50)
    }
    if (c.type === 'heal') cls.push('heal');
    if (c.type === 'food') cls.push('food');
    if (!available) cls.push('used');
    if (game.isProcessing) cls.push('disabled');
    if (cardsDealt) cls.push('dealt');

    // Effect label
    let effect = '';
    if (c.type === 'attack') {
      const dmg = game.isDrunk ? Math.round(c.baseDmg * 0.5) : c.baseDmg;
      effect = `Damage: ${dmg}p`;
    } else if (c.type === 'crit') {
      const dmg = game.isDrunk ? Math.round(critDmg * 0.5) : critDmg;
      effect = `Damage: ${dmg}p`;
    } else if (c.type === 'heal') {
      effect = `Protection: ${c.heal}p`;
    } else if (c.type === 'food') {
      effect = `Cures drunk`;
    }

    const drunkBadge = game.isDrunk && (c.type === 'attack' || c.type === 'crit')
      ? '<img class="card-drunk-badge" src="assets/50percent.png" alt="-50%">' : '';

    // Tooltip descriptions
    let tooltip = '';
    if (c.type === 'attack') tooltip = 'Basic attack. Deals 25 damage. Reusable every turn.';
    else if (c.type === 'crit') tooltip = 'Powerful attack that charges: 30 → 40 → 50 dmg. Using it resets the charge.';
    else if (c.type === 'heal') tooltip = 'Recovers 25 HP + shield (blocks next attack to 10 dmg). Single use!';
    else if (c.type === 'food') tooltip = 'Cures Drunk status and resets hit counter. No effect if not drunk.';

    return `
      <div class="${cls.join(' ')}" onclick="playCard('${c.id}')" data-id="${c.id}">
        <img class="card-bg" src="${cardBg[c.type]}" alt="" draggable="false">
        ${drunkBadge}
        <span class="card-name">${c.name}</span>
        <span class="card-effect">${effect}</span>
        <span class="card-tooltip">${tooltip}</span>
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

function showDrunkBanner() {
  const el = $('drunkBanner');
  el.classList.add('hidden');
  void el.offsetWidth;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 1200);
}

function showYourTurn() {
  const el = $('yourTurnBanner');
  el.classList.add('hidden');
  // Force reflow to restart the CSS animation
  void el.offsetWidth;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 1200);
}

// --- Game Timer ---
let _timerInterval = null;
let _timerSeconds = 0;

function startGameTimer() {
  _timerSeconds = 0;
  updateTimerDisplay(0);
  clearInterval(_timerInterval);
  _timerInterval = setInterval(() => {
    _timerSeconds++;
    updateTimerDisplay(_timerSeconds);
  }, 1000);
}

function stopGameTimer() {
  clearInterval(_timerInterval);
  _timerInterval = null;
}

function updateTimerDisplay(totalSec) {
  const m = Math.min(Math.floor(totalSec / 60), 9); // max 9 minutes
  const s = totalSec % 60;
  const s1 = Math.floor(s / 10);
  const s2 = s % 10;
  $('timerM').src = 'assets/timer/' + m + '.webp';
  $('timerS1').src = 'assets/timer/' + s1 + '.webp';
  $('timerS2').src = 'assets/timer/' + s2 + '.webp';
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

// --- Leaderboard rendering (shared) ---
function renderLeaderboardHTML(entries, highlightName, highlightScore) {
  const header = `<div class="lb-row lb-header">
    <span></span><span>Name</span><span class="lb-score">Score</span><span class="lb-hp">HP</span><span class="lb-turns">Turns</span><span class="lb-time">Time</span>
  </div>`;
  const rows = entries.map(e => {
    const isMe = highlightName && e.name === highlightName && e.score === highlightScore;
    const time = e.time != null ? formatTime(e.time) : '-';
    return `<div class="lb-row${isMe ? ' lb-highlight' : ''}">
      <span class="lb-rank">#${e.rank}</span>
      <span class="lb-name">${e.name}</span>
      <span class="lb-score">${e.score}</span>
      <span class="lb-hp">${e.hp}%</span>
      <span class="lb-turns">${e.turns}</span>
      <span class="lb-time">${time}</span>
    </div>`;
  }).join('');
  return header + rows;
}

// --- Score & Leaderboard (result screen) ---
async function showScoreAndLeaderboard(score, name) {
  $('scoreValue').textContent = score;
  $('scoreDisplay').classList.remove('hidden');

  const entries = await getLeaderboard(10);
  if (entries.length === 0) return;

  $('leaderboardBody').innerHTML = renderLeaderboardHTML(entries, name, score);
  $('leaderboard').classList.remove('hidden');
}

// --- Leaderboard on title screen ---
async function loadTitleLeaderboard() {
  const entries = await getLeaderboard(10);
  const container = $('titleLeaderboard');
  if (entries.length === 0) {
    container.style.display = 'none';
    return;
  }
  $('titleLeaderboardBody').innerHTML = renderLeaderboardHTML(entries);
  container.style.display = '';
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
      const src = `${this.folder}/frame_${String(i).padStart(5, '0')}.webp`;
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
const botLaughAnim = new FrameAnimator($('botCanvas'), 'assets/frames/bot-laugh', 75, 40);
const userFoodAnim = new FrameAnimator($('userCanvas'), 'assets/frames/user-food', 66, 40);
const userDrunkAnim = new FrameAnimator($('userCanvas'), 'assets/frames/user-drunk', 75, 40);

// Preload in two phases for faster startup
const phase1Animators = [bgAnim, userDefaultAnim, botDefaultAnim]; // idle — needed to start
const phase2Animators = [userAttackAnim, userAttackRevAnim, userDefenseAnim, botAttackAnim, botDefenseAnim, userRockAttackAnim, lightningAnim, userHealAnim, botLaughAnim, userFoodAnim, userDrunkAnim]; // combat — loaded in background
const allAnimators = [...phase1Animators, ...phase2Animators];
const cardImageSrcs = [
  'assets/cards/attack.jpg',
  'assets/cards/rock-30.jpg',
  'assets/cards/rock-40.jpg',
  'assets/cards/rock-50.jpg',
  'assets/cards/protection.jpg'
];
const phase1Frames = phase1Animators.reduce((sum, a) => sum + a.count, 0) + cardImageSrcs.length;
let loadedFrames = 0;

// Helper: wait for an animator to be ready (used by combat functions)
function waitReady(animator) {
  if (animator.ready) return Promise.resolve();
  return new Promise(resolve => {
    const check = () => animator.ready ? resolve() : requestAnimationFrame(check);
    check();
  });
}

// --- Title screen → Name screen ---
let playerName = 'Player';

// Load leaderboard on title screen
loadTitleLeaderboard();

$('startGameBtn').addEventListener('click', () => {
  $('titleScreen').classList.add('hidden');
  $('nameScreen').classList.remove('hidden');
  $('playerNameInput').focus();
});

// --- Name screen → Video intro (skip chapter select) ---
function confirmName() {
  const raw = $('playerNameInput').value.trim();
  if (!raw) return;
  playerName = raw;
  $('playerNameLabel').textContent = playerName;
  $('nameScreen').classList.add('hidden');
  $('videoIntro').classList.remove('hidden');
  $('introVideo').play().catch(() => {});
  startVideoMusic(_introMusic);
  _introRaf = requestAnimationFrame(pollIntro);
}

$('nameConfirmBtn').addEventListener('click', confirmName);
$('playerNameInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') confirmName();
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
  const pct = (loadedFrames / phase1Frames) * 100;
  loadingFill.style.width = `${Math.min(pct, 100)}%`;
}

let _preloadResolve;
const allPreloaded = new Promise(r => { _preloadResolve = r; });

// Keep references to decoded card images so the browser keeps them in cache
const _cardImageCache = [];

function startPreloading() {
// Phase 1: load idle animations + card images (fully decoded)
const cardImagePromises = cardImageSrcs.map(src => {
  const img = new Image();
  img.src = src;
  _cardImageCache.push(img);
  return img.decode().then(() => onFrameLoaded(), () => onFrameLoaded());
});
Promise.all([
  ...phase1Animators.map(a => a.preload(onFrameLoaded)),
  ...cardImagePromises
]).then(() => bgAnim.bakeFilter()).then(() => {
  const screen = $('loadingScreen');
  screen.classList.add('fade-out');
  setTimeout(() => screen.remove(), 500);

  // Phase 2: load combat animations silently in background
  Promise.all(phase2Animators.map(a => a.preload())).catch(() => {});

  // Preload background music so it's ready instantly on click
  const bgMusic = new Audio('assets/music.mp3');
  bgMusic.loop = true;
  bgMusic.volume = 0.08;
  bgMusic.preload = 'auto';
  window._bgMusic = bgMusic;

  // --- Step-by-step instructions navigation ---
  const introSteps = document.querySelectorAll('.intro-step');
  const introDots  = document.querySelectorAll('.intro-dot');
  const prevBtn    = $('introPrev');
  const nextBtn    = $('introNext');
  let currentStep  = 0;
  const totalSteps = introSteps.length;

  const introTitle = document.querySelector('.intro-content h2');
  const dotsContainer = $('introDots');

  function showStep(n) {
    currentStep = n;
    introSteps.forEach(s => s.classList.remove('active'));
    introDots.forEach(d => d.classList.remove('active'));
    introSteps[n].classList.add('active');
    if (introDots[n]) introDots[n].classList.add('active');
    const isLast = n === totalSteps - 1;
    prevBtn.style.visibility = n === 0 ? 'hidden' : 'visible';
    nextBtn.style.visibility = isLast ? 'hidden' : 'visible';
    // Hide title, arrows, dots on last step
    introTitle.style.display = isLast ? 'none' : '';
    prevBtn.style.display = isLast ? 'none' : '';
    nextBtn.style.display = isLast ? 'none' : '';
    dotsContainer.style.display = isLast ? 'none' : '';
    $('skipTutorialBtn').style.display = isLast ? 'none' : '';
    // Restart diagram animations by re-inserting the SVG
    const diagram = introSteps[n].querySelector('.step-diagram');
    if (diagram) {
      const svg = diagram.querySelector('svg');
      if (svg) { const clone = svg.cloneNode(true); svg.replaceWith(clone); }
    }
  }

  nextBtn.addEventListener('click', () => {
    if (currentStep < totalSteps - 1) showStep(currentStep + 1);
  });
  prevBtn.addEventListener('click', () => {
    if (currentStep > 0) showStep(currentStep - 1);
  });
  $('startBattleBtn').addEventListener('click', () => {
    $('introOverlay').classList.add('hidden');
    showYourTurn();
    bgMusic.play().catch(() => {});
  });
  $('skipTutorialBtn').addEventListener('click', () => {
    $('introOverlay').classList.add('hidden');
    showYourTurn();
    bgMusic.play().catch(() => {});
  });
  $('replayTutorialBtn').addEventListener('click', () => {
    showStep(0);
  });
  introDots.forEach(dot => {
    dot.addEventListener('click', () => showStep(parseInt(dot.dataset.dot, 10)));
  });
  showStep(0);
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
      await Promise.all([waitReady(userRockAttackAnim), waitReady(lightningAnim)]);
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
      await Promise.all([waitReady(userAttackAnim), waitReady(userAttackRevAnim)]);
      setTimeout(arenaShake, 750);
      attack = (async () => {
        await userAttackAnim.playOnce();
        await userAttackRevAnim.playOnce();
      })();
    }

    const defenseDelay = isBonus ? 550 : 750;
    const defense = (async () => {
      await delay(defenseDelay);
      await waitReady(botDefenseAnim);
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
    await Promise.all([waitReady(botAttackAnim), waitReady(userDefenseAnim)]);
    botCanvas.classList.add('z-front');
    botDefaultAnim.stop();
    setTimeout(() => playSfx('assets/beer-attack.mp3', 0.15, 2.0), 600);
    const attack = botAttackAnim.playOnce();

    const defense = (async () => {
      await delay(1050);
      userDefaultAnim.stop();
      userDefenseAnim.stop();
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
    await waitReady(userHealAnim);
    const canvas = $('userCanvas');
    canvas.classList.add('z-front');
    userDefaultAnim.stop();
    playSfx('assets/Burbuja.mp3');
    await userHealAnim.playOnce();
    canvas.classList.add('shield-glow');
    canvas.classList.remove('z-front');
    userDefaultAnim.startLoop();
    resolve();
  });
}

// Bot laughs when MC gets drunk
function playBotLaugh() {
  return new Promise(async resolve => {
    await waitReady(botLaughAnim);
    botDefaultAnim.stop();
    botLaughAnim.stop();
    await botLaughAnim.playOncePingPong();
    botDefaultAnim.startLoop();
    resolve();
  });
}

// Food card animation (MC hides behind campero)
function playFoodAnimation() {
  return new Promise(async resolve => {
    await waitReady(userFoodAnim);
    const canvas = $('userCanvas');
    canvas.classList.add('food-glow');
    userDefaultAnim.stop();
    userFoodAnim.stop();
    await userFoodAnim.playOnce();
    // Immediate switch — no fade, just start idle instantly
    canvas.classList.remove('food-glow');
    userDefaultAnim._drawFrame(0);
    userDefaultAnim.startLoop();
    resolve();
  });
}

// MC drunk reaction — plays when drunk activates and at start of each drunk turn
function playDrunkReaction() {
  return new Promise(async resolve => {
    await waitReady(userDrunkAnim);
    userDefaultAnim.stop();
    userDrunkAnim.stop();
    await userDrunkAnim.playOncePingPong();
    userDefaultAnim.startLoop();
    resolve();
  });
}

function removeShieldGlow() {
  $('userCanvas').classList.remove('shield-glow');
  // Merge heal segment into main bar and dissolve
  const healFill = $('playerHealFill');
  const fill = $('playerHearts').querySelector('.hp-bar-fill');
  if (healFill && _healBase >= 0) {
    // Extend main bar to cover the heal portion
    const totalPct = parseFloat(fill.style.width) + parseFloat(healFill.style.width);
    fill.style.width = totalPct + '%';
    fill.classList.remove('healing');
    // Fade out heal fill
    healFill.style.transition = 'opacity 0.6s ease';
    healFill.style.opacity = '0';
    _healBase = -1;
  }
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
