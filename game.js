const LANDSCAPE_STAGE = { width: 1280, height: 720 };
const PORTRAIT_STAGE = { width: 720, height: 1280 };
const HIDE_AFTER_CATCH_DELAY = 0.28;
const FRAME_DURATION = 0.05;
const MOVE_DURATION = 0.3;
const MOVE_OFFSET_Y = 170;
const HIGH_SCORE_KEY = 'helpSquirrelMiniGameHighScore';
const QUERY = Object.fromEntries(new URLSearchParams(location.search).entries());
const ROUND_DURATION = Math.max(8, Number(QUERY.round) || 25);
const STASH_GOAL = Math.max(1, Number(QUERY.goal) || 12);
const WAVE2_AT = ROUND_DURATION * 0.32;
const WAVE3_AT = ROUND_DURATION * 0.64;
const COIN_TOSS_DURATION = 0.18;
const COIN_MISS_DURATION = 0.45;
const WIN_END_DELAY = 0.55;

const IS_SAFARI = /^((?!chrome|chromium|crios|fxios|edgios|android).)*safari/i.test(navigator.userAgent);
const USE_SMALL_FRAMES = IS_SAFARI || window.matchMedia('(pointer: coarse)').matches;
const STAR_COUNT = IS_SAFARI ? 4 : 6;
const MAX_ACTIVE_SFX = 8;
const DEBUG_FLAGS = Object.assign(
    { sound: true, stars: true, squirrel: true, coins: true },
    QUERY
);
const FLAG_ON = v => v !== '0' && v !== 'false' && v !== false;

const ANIMATIONS = {
    idle: ['idle-1', 'idle-2', 'idle-3', 'idle-4'],
    aftershock: ['aftershock-1', 'aftershock-2', 'aftershock-3', 'aftershock-4'],
    punch: ['punch-1', 'punch-2', 'punch-3', 'punch-4']
};
const SQUIRREL_FRAMES = [
    'staticSquirrel',
    ...ANIMATIONS.idle,
    ...ANIMATIONS.aftershock,
    ...ANIMATIONS.punch
];

const Atlas = {
    size: 2048,
    urls: [
        'assets/atlases/atlas-0.webp',
        'assets/atlases/atlas-1.webp',
        'assets/atlases/atlas-2.webp'
    ],
    frames: null,
    images: [],
    frameImages: {},
    async load() {
        if (!this.frames) {
            const response = await fetch('assets/atlases/atlas.json');
            const data = await response.json();
            this.size = data.size;
            this.urls = data.atlases;
            this.frames = data.frames;
        }
        this.images = await Promise.all(this.urls.map(src => new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        })));
        if (USE_SMALL_FRAMES) {
            await Promise.all(SQUIRREL_FRAMES.map(name => new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = async () => {
                    try {
                        if (img.decode) await img.decode();
                    } catch {}
                    this.frameImages[name] = img;
                    resolve();
                };
                img.onerror = reject;
                img.src = `assets/frames/${name}.webp?v=joy`;
            })));
        }
    },
    _cropFrame(name) {
        const frame = this.frames[name];
        const canvas = document.createElement('canvas');
        canvas.width = frame.w;
        canvas.height = frame.h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.images[frame.atlas], -frame.x, -frame.y);
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (!blob) {
                    reject(new Error(`Failed to crop atlas frame ${name}`));
                    return;
                }
                resolve(URL.createObjectURL(blob));
            }, 'image/png');
        });
    },
    paint(el, name, fit) {
        const frame = this.frames[name];
        if (!el || !frame) return;

        const url = this.urls[frame.atlas];
        const cw = el.clientWidth;
        const ch = el.clientHeight;
        if (cw <= 0 || ch <= 0) return;

        if (el.dataset.atlasUrl !== url) {
            el.dataset.atlasUrl = url;
            el.style.backgroundImage = `url("${url}")`;
        }
        el.style.backgroundRepeat = 'no-repeat';
        el.style.clipPath = 'none';

        if (fit === 'fill') {
            const sx = cw / frame.w;
            const sy = ch / frame.h;
            el.style.backgroundSize = `${this.size * sx}px ${this.size * sy}px`;
            el.style.backgroundPosition = `${-frame.x * sx}px ${-frame.y * sy}px`;
            return;
        }

        const scale = (fit === 'cover' || fit === 'cover-y40')
            ? Math.max(cw / frame.w, ch / frame.h)
            : Math.min(cw / frame.w, ch / frame.h);
        const dw = frame.w * scale;
        const dh = frame.h * scale;
        const posX = (cw - dw) / 2;
        let posY = (ch - dh) / 2;
        if (fit === 'contain-bottom') posY = ch - dh;
        if (fit === 'cover-y40') posY = (ch - dh) * 0.4;

        el.style.backgroundSize = `${this.size * scale}px ${this.size * scale}px`;
        el.style.backgroundPosition = `${posX - frame.x * scale}px ${posY - frame.y * scale}px`;

        if (fit === 'contain' || fit === 'contain-bottom') {
            const insetTop = Math.max(0, posY);
            const insetRight = Math.max(0, cw - posX - dw);
            const insetBottom = Math.max(0, ch - posY - dh);
            const insetLeft = Math.max(0, posX);
            el.style.clipPath = `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px)`;
        }
    }
};

const SOUNDS = {
    music: { srcs: ['assets/sounds/squirrelMiniGameMusic.ogg'], shuffled: false },
    show: {
        srcs: [
            'assets/sounds/squirrelMiniGameShow_1.ogg',
            'assets/sounds/squirrelMiniGameShow_2.ogg',
            'assets/sounds/squirrelMiniGameShow_3.ogg'
        ],
        shuffled: true
    },
    hide: {
        srcs: [
            'assets/sounds/squirrelMiniGameHide_1.ogg',
            'assets/sounds/squirrelMiniGameHide_2.ogg',
            'assets/sounds/squirrelMiniGameHide_3.ogg'
        ],
        shuffled: true
    },
    hitTarget: {
        srcs: [
            'assets/sounds/squirrelMiniGameHammerHitTheTarget_1.ogg',
            'assets/sounds/squirrelMiniGameHammerHitTheTarget_2.ogg'
        ],
        shuffled: false,
        random: true
    },
    scream: {
        srcs: [
            'assets/sounds/squirrelMiniGameHammerHitsquirellScream_1.ogg',
            'assets/sounds/squirrelMiniGameHammerHitsquirellScream_2.ogg',
            'assets/sounds/squirrelMiniGameHammerHitsquirellScream_3.ogg'
        ],
        shuffled: true
    },
    miss: {
        srcs: [
            'assets/sounds/squirrelMiniGameHammerMiss_1.ogg',
            'assets/sounds/squirrelMiniGameHammerMiss_2.ogg',
            'assets/sounds/squirrelMiniGameHammerMiss_3.ogg'
        ],
        shuffled: true
    },
    stars: {
        srcs: [
            'assets/sounds/squirrelMiniGameStars_1.ogg',
            'assets/sounds/squirrelMiniGameStars_2.ogg',
            'assets/sounds/squirrelMiniGameStars_3.ogg'
        ],
        shuffled: true
    }
};

function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
}

function nowSeconds() {
    return performance.now() / 1000;
}

function tween(duration, onUpdate, onComplete) {
    const start = nowSeconds();
    let rafId = 0;
    let cancelled = false;

    const step = () => {
        if (cancelled) return;
        const t = duration <= 0 ? 1 : Math.min(1, (nowSeconds() - start) / duration);
        onUpdate(easeOutQuad(t));
        if (t < 1) {
            rafId = requestAnimationFrame(step);
        } else if (onComplete) {
            onComplete();
        }
    };

    rafId = requestAnimationFrame(step);

    return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
    };
}

class AudioManager {
    constructor() {
        this.lastIndex = {};
        this.musicAudio = null;
        this.unlocked = false;
        this.ctx = null;
        this.buffers = {};
        this.spriteMap = null;
        this.spriteReady = null;
        this.spriteAssets = null;
        this.activeSources = new Set();
        this.ext = this._pickExt();
    }

    _pickExt() {
        const probe = document.createElement('audio');
        if (probe.canPlayType('audio/mp4; codecs="mp4a.40.2"')) return 'm4a';
        if (probe.canPlayType('audio/mpeg')) return 'mp3';
        return 'ogg';
    }

    _src(path) {
        return this.ext === 'ogg' ? path : path.replace(/\.ogg$/i, `.${this.ext}`);
    }

    preload() {
        if (!this.spriteAssets) {
            this.spriteAssets = Promise.all([
                fetch('assets/sounds/sprites.json').then(response => response.json()),
                fetch('assets/sounds/sprites.m4a').then(response => response.arrayBuffer())
            ]);
        }

        this._ensureContext();
        if (this.ctx) this._loadSprite();
    }

    _ensureContext() {
        if (this.ctx) return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;

        try {
            this.ctx = new Ctx();
        } catch {
            this.ctx = null;
        }
    }

    unlock() {
        if (this.unlocked) return;
        this.unlocked = true;

        this.preload();
        if (this.ctx) {
            this.ctx.resume().catch(() => {});
            this._loadSprite();
        }

        this.playMusic();
    }

    _loadSprite() {
        if (this.spriteReady) return this.spriteReady;

        if (!this.spriteAssets || !this.ctx) return Promise.resolve();
        this.spriteReady = this.spriteAssets.then(([meta, data]) => {
            return this._decode(data).then(buffer => [meta, buffer]);
        }).then(([meta, buffer]) => {
            this.spriteMap = {};
            meta.forEach(m => { this.spriteMap[m.name] = m; });
            this.buffers.__sprite = buffer;
        }).catch(() => {});
        return this.spriteReady;
    }

    play(name) {
        if (!this.unlocked) return;
        if (!FLAG_ON(DEBUG_FLAGS.sound)) return;
        const entry = SOUNDS[name];
        if (!entry) return;

        const srcs = entry.srcs;
        let index;

        if (srcs.length === 1) {
            index = 0;
        } else if (entry.random || entry.shuffled) {
            index = Math.floor(Math.random() * srcs.length);
            if (entry.shuffled && srcs.length > 1 && index === this.lastIndex[name]) {
                index = (index + 1) % srcs.length;
            }
        } else {
            index = 0;
        }

        this.lastIndex[name] = index;
        const stem = srcs[index].split('/').pop().replace(/\.ogg$/i, '');
        this._playSpriteClip(stem);
    }

    _playSpriteClip(stem) {
        const meta = this.spriteMap && this.spriteMap[stem];
        const buffer = this.buffers.__sprite;
        if (!this.ctx || !meta || !buffer || this.ctx.state !== 'running') return;
        if (this.activeSources.size >= MAX_ACTIVE_SFX) return;

        const node = this.ctx.createBufferSource();
        node.buffer = buffer;
        node.connect(this.ctx.destination);
        this.activeSources.add(node);

        const release = () => {
            node.onended = null;
            node.disconnect();
            this.activeSources.delete(node);
        };
        node.onended = release;

        try {
            node.start(0, meta.start, meta.dur);
        } catch {
            release();
        }
    }

    playMusic() {
        if (!this.unlocked) return;
        if (!FLAG_ON(DEBUG_FLAGS.sound)) return;

        if (this.musicAudio) {
            this.musicAudio.play().catch(() => {});
            return;
        }

        this.musicAudio = new Audio(this._src(SOUNDS.music.srcs[0]));
        this.musicAudio.loop = true;
        this.musicAudio.volume = 1;
        this.musicAudio.playsInline = true;
        this.musicAudio.play().catch(() => {});
    }

    stopMusic() {
        if (!this.musicAudio) return;
        this.musicAudio.pause();
        this.musicAudio = null;
    }

    _decode(data) {
        return new Promise((resolve, reject) => {
            this.ctx.decodeAudioData(data.slice(0), resolve, reject);
        });
    }
}

class SquirrelPlayer {
    constructor(element, index) {
        this.element = element;
        this.index = index;
        this.sprite = element.querySelector('.squirrel-img');
        this.interactable = false;
        this.animCancel = null;
        this.moveCancel = null;
        this.isPunchPlaying = false;
        this.isShockPlaying = false;
        this.offsetY = MOVE_OFFSET_Y;
        this.appearanceToken = 0;
        this.scoredThisAppearance = false;
        this.hideTimer = null;
        this._setOffset(MOVE_OFFSET_Y);
        this._syncHitbox();
    }

    resetDown() {
        this.stopAll();
        this.playStatic();
        this._setOffset(MOVE_OFFSET_Y);
        this.setInteractable(false);
        this.scoredThisAppearance = false;
    }

    setInteractable(state) {
        this.interactable = state;
        this._syncHitbox();
    }

    playStatic() {
        this._stopAnim();
        this.isPunchPlaying = false;
        this.isShockPlaying = false;
        this._setFrame('staticSquirrel');
    }

    playIdle(yoyo, onComplete) {
        this.playAnimation(ANIMATIONS.idle, yoyo, onComplete);
    }

    playShock(yoyo, onComplete) {
        if (this.isShockPlaying) return false;

        this.isShockPlaying = true;
        this.playAnimation(ANIMATIONS.aftershock, yoyo, () => {
            this.isShockPlaying = false;
            if (onComplete) onComplete();
        });
        return true;
    }

    playPunch(yoyo, onComplete) {
        if (this.isPunchPlaying || this.isShockPlaying) return false;

        this.isPunchPlaying = true;
        this.playAnimation(ANIMATIONS.punch, yoyo, () => {
            this.isPunchPlaying = false;
            if (onComplete) onComplete();
        }, 0.09);
        return true;
    }

    playAnimation(frames, yoyo, onComplete, frameDuration) {
        this._stopAnim();
        if (!frames || frames.length === 0) return;
        if (!FLAG_ON(DEBUG_FLAGS.squirrel)) {
            if (onComplete) onComplete();
            return;
        }

        const sequence = yoyo
            ? frames.concat(frames.slice().reverse())
            : frames.slice();

        let frameIndex = 0;
        let timeoutId = 0;
        let cancelled = false;

        const showFrame = () => {
            if (cancelled) return;
            this._setFrame(sequence[frameIndex]);
            frameIndex += 1;
            timeoutId = setTimeout(() => {
                if (cancelled) return;
                if (frameIndex < sequence.length) {
                    showFrame();
                } else if (onComplete) {
                    onComplete();
                }
            }, (frameDuration ?? FRAME_DURATION) * 1000);
        };

        showFrame();

        this.animCancel = () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }

    _setFrame(name) {
        if (USE_SMALL_FRAMES) {
            const url = `assets/frames/${name}.webp?v=joy`;
            if (this._frameUrl !== url) {
                this._frameUrl = url;
                this.sprite.style.backgroundImage = `url("${url}")`;
                this.sprite.style.backgroundSize = 'cover';
                this.sprite.style.backgroundPosition = 'center';
            }
            return;
        }

        if (!this._frameCache) this._frameCache = {};
        let style = this._frameCache[name];
        if (!style) {
            const frame = Atlas.frames[name];
            if (!frame) return;
            const cw = this.sprite.clientWidth;
            const ch = this.sprite.clientHeight;
            const sx = cw / frame.w;
            const sy = ch / frame.h;
            style = {
                size: `${Atlas.size * sx}px ${Atlas.size * sy}px`,
                pos: `${-frame.x * sx}px ${-frame.y * sy}px`,
                url: Atlas.urls[frame.atlas]
            };
            this._frameCache[name] = style;
        }
        if (this.sprite.style.backgroundImage !== `url("${style.url}")`) {
            this.sprite.style.backgroundImage = `url("${style.url}")`;
        }
        this.sprite.style.backgroundSize = style.size;
        this.sprite.style.backgroundPosition = style.pos;
    }

    move(isUp, onComplete) {
        this._stopMove();

        const from = this.offsetY;
        const to = isUp ? 0 : MOVE_OFFSET_Y;

        this.moveCancel = tween(MOVE_DURATION, t => {
            this._setOffset(from + (to - from) * t);
        }, () => {
            this.moveCancel = null;
            this._setOffset(to);
            this._syncHitbox();
            if (onComplete) onComplete();
        });
    }

    stopAll() {
        this._stopAnim();
        this._stopMove();
        this.isPunchPlaying = false;
        this.isShockPlaying = false;
    }

    _setOffset(offsetY) {
        this.offsetY = offsetY;
        this.sprite.style.transform = `translate3d(0, ${offsetY}px, 0)`;
    }

    _syncHitbox() {
        this.sprite.classList.toggle('is-hidden', !this.interactable);
    }

    _stopAnim() {
        if (this.animCancel) {
            this.animCancel();
            this.animCancel = null;
        }
    }

    _stopMove() {
        if (this.moveCancel) {
            this.moveCancel();
            this.moveCancel = null;
        }
    }
}

class CoinFx {
    constructor(stage, layer, particlesRoot) {
        this.stage = stage;
        this.layer = layer;
        this.canvas = particlesRoot.querySelector('#particles-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.pool = [];
        this.stars = [];
        this.starImg = new Image();
        this.starImg.src = 'assets/textures/brand-star.webp';
        this.rafId = 0;
        this._resizeCanvas();
        if (window.ResizeObserver && this.canvas) {
            this._ro = new ResizeObserver(() => this._resizeCanvas());
            this._ro.observe(particlesRoot);
        }
    }

    _resizeCanvas() {
        if (!this.canvas || !this.stage) return;
        const w = this.stage.clientWidth;
        const h = this.stage.clientHeight;
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
    }

    _takeCoin() {
        const el = this.pool.pop() || document.createElement('div');
        el.className = 'fx-coin';
        if (!el.parentNode) this.layer.appendChild(el);
        el.style.opacity = '1';
        return el;
    }

    _place(el, x, y, rot, scale) {
        const size = el.offsetWidth || 72;
        el.style.transform =
            `translate(${x - size / 2}px, ${y - size / 2}px) rotate(${rot}deg) scale(${scale})`;
    }

    tossTo(fromX, fromY, toX, toY) {
        if (!FLAG_ON(DEBUG_FLAGS.coins)) return;
        const el = this._takeCoin();
        this._place(el, fromX, fromY, -20, 0.55);
        tween(COIN_TOSS_DURATION, t => {
            this._place(
                el,
                fromX + (toX - fromX) * t,
                fromY + (toY - fromY) * t,
                -20 + t * 140,
                0.55 + t * 0.5
            );
        }, () => {
            this._place(el, toX, toY, 120, 1.05);
            this.spawnStars(toX, toY);
            el.style.opacity = '0';
            this.pool.push(el);
        });
    }

    missAt(x, y) {
        if (!FLAG_ON(DEBUG_FLAGS.coins)) return;
        const el = this._takeCoin();
        const drift = (Math.random() * 80) - 40;
        this._place(el, x, y, 0, 0.85);
        tween(COIN_MISS_DURATION, t => {
            this._place(el, x + drift * t, y + t * t * 260, t * 200, 0.85 - t * 0.25);
            el.style.opacity = String(1 - t);
        }, () => {
            el.style.opacity = '0';
            this.pool.push(el);
        });
    }

    floatText(x, y, text) {
        const el = document.createElement('div');
        el.className = 'fx-float';
        el.textContent = text;
        this.layer.appendChild(el);
        el.style.transform = `translate(${x}px, ${y}px)`;
        tween(0.7, t => {
            el.style.transform = `translate(${x}px, ${y - 70 * t}px)`;
            el.style.opacity = String(1 - t);
        }, () => el.remove());
    }

    spawnStars(x, y) {
        if (!this.ctx) return;
        if (!FLAG_ON(DEBUG_FLAGS.stars)) return;

        for (let i = 0; i < STAR_COUNT; i++) {
            const angle = (Math.PI * 2 * i) / STAR_COUNT + Math.random() * 0.35;
            const distance = 46 + Math.random() * 42;
            this.stars.push({
                x, y,
                vx: Math.cos(angle) * distance,
                vy: Math.sin(angle) * distance,
                size: 22 + Math.random() * 14,
                rot: Math.random() * Math.PI,
                born: performance.now()
            });
        }

        if (!this.rafId) this._tick();
    }

    _tick() {
        this.rafId = requestAnimationFrame(() => {
            const now = performance.now();
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            const img = this.starImg;
            const ready = img.complete && img.naturalWidth > 0;

            this.stars = this.stars.filter(star => {
                const age = (now - star.born) / 480;
                if (age >= 1) return false;

                const t = 1 - Math.pow(1 - age, 2);
                const cx = star.x + star.vx * t;
                const cy = star.y + star.vy * t;
                const scale = 1 - age * 0.75;
                const s = star.size * scale;

                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(star.rot + age * 1.6);
                ctx.globalAlpha = 1 - age;
                if (ready) {
                    ctx.drawImage(img, -s / 2, -s / 2, s, s);
                } else {
                    ctx.fillStyle = '#902FF2';
                    ctx.beginPath();
                    ctx.moveTo(0, -s / 2);
                    ctx.lineTo(s * 0.18, 0);
                    ctx.lineTo(0, s / 2);
                    ctx.lineTo(-s * 0.18, 0);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
                return true;
            });

            if (this.stars.length > 0) {
                this._tick();
            } else {
                this.rafId = 0;
                ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
        });
    }
}

class ScoreManager {
    constructor() {
        this.stash = 0;
        this.combo = 0;
        this.bestCombo = 0;
        this.highScore = this._loadHighScore();
        this.stashFill = document.getElementById('stash-fill');
        this.stashValue = document.getElementById('stash-value');
        this.highScoreElement = document.getElementById('high-score-value');
        this.comboBanner = document.getElementById('combo-banner');
        this.highScoreElement.textContent = this.highScore;
        this._render();
        window.addEventListener('pagehide', () => this.persist());
    }

    multiplier() {
        if (this.combo >= 6) return 3;
        if (this.combo >= 3) return 2;
        return 1;
    }

    addCatch() {
        this.combo += 1;
        if (this.combo > this.bestCombo) this.bestCombo = this.combo;
        const gained = this.multiplier();
        this.stash += gained;
        if (this.stash > this.highScore) {
            this.highScore = this.stash;
            this.highScoreElement.textContent = this.highScore;
        }
        this._render();
        return gained;
    }

    breakCombo() {
        if (this.combo === 0) return;
        this.combo = 0;
        this._render();
    }

    reset() {
        this.stash = 0;
        this.combo = 0;
        this.bestCombo = 0;
        this._render();
    }

    persist() {
        localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
    }

    _render() {
        const ratio = Math.min(1, this.stash / STASH_GOAL);
        this.stashFill.style.width = `${ratio * 100}%`;
        this.stashValue.textContent = `${this.stash}/${STASH_GOAL}`;
        const mult = this.multiplier();
        if (this.combo >= 3) {
            this.comboBanner.hidden = false;
            this.comboBanner.textContent = `Серия ×${mult}`;
        } else {
            this.comboBanner.hidden = true;
        }
    }

    _loadHighScore() {
        const current = parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10);
        return Number.isNaN(current) ? 0 : current;
    }
}

class HelpTheSquirrelGame {
    constructor() {
        this.stage = document.getElementById('stage');
        this.overlay = document.getElementById('overlay');
        this.overlayTitle = document.getElementById('overlay-title');
        this.overlayText = document.getElementById('overlay-text');
        this.overlayStats = document.getElementById('overlay-stats');
        this.playButton = document.getElementById('play-button');
        this.timerValue = document.getElementById('timer-value');
        this.audioManager = new AudioManager();
        this.coins = new CoinFx(
            this.stage,
            document.getElementById('fx-layer'),
            document.getElementById('particles')
        );
        this.scoreManager = new ScoreManager();
        this.squirrels = [];
        this.active = new Set();
        this.hiding = new Set();
        this.appearanceSeq = 0;
        this.isPlaying = false;
        this.roundClosing = false;
        this.roundStart = 0;
        this.roundRaf = 0;
        this.endTimer = null;
        this.stageWidth = LANDSCAPE_STAGE.width;
        this.stageHeight = LANDSCAPE_STAGE.height;
        this.isPortrait = false;
        this._artKey = '';

        this._initSquirrels();
        this._bindEvents();
        this._fitStage();
        this._setTimer(ROUND_DURATION);
        this.audioManager.preload();
    }

    _applyWorldArt() {
        if (!Atlas.frames) return;
        const bgFit = this.isPortrait ? 'cover-y40' : 'fill';
        Atlas.paint(document.getElementById('background'), 'HitTheSquirrelMiniGame_Bg', bgFit);
    }

    _initSquirrels() {
        const holes = document.querySelectorAll('.hole');
        holes.forEach((hole, index) => {
            this.squirrels.push(new SquirrelPlayer(hole, index));
        });
    }

    _fitStage() {
        const isPortrait = window.innerHeight > window.innerWidth;
        this.isPortrait = isPortrait;
        document.body.classList.toggle('portrait', isPortrait);
        document.body.classList.toggle('landscape', !isPortrait);

        if (isPortrait) {
            this.stageWidth = PORTRAIT_STAGE.width;
            this.stageHeight = Math.round(PORTRAIT_STAGE.width * window.innerHeight / window.innerWidth);
            const scale = window.innerWidth / this.stageWidth;
            this.stage.style.width = `${this.stageWidth}px`;
            this.stage.style.height = `${this.stageHeight}px`;
            this.stage.style.transform = `scale(${scale})`;
        } else {
            this.stageWidth = LANDSCAPE_STAGE.width;
            this.stageHeight = LANDSCAPE_STAGE.height;
            this.stage.style.width = `${this.stageWidth}px`;
            this.stage.style.height = `${this.stageHeight}px`;
            const scale = Math.min(
                window.innerWidth / this.stageWidth,
                window.innerHeight / this.stageHeight
            );
            this.stage.style.transform = `scale(${scale})`;
        }

        const artKey = `${this.isPortrait}|${this.stageWidth}|${this.stageHeight}`;
        if (this._artKey === artKey) return;
        this._artKey = artKey;
        this._applyWorldArt();
    }

    _clientToStage(clientX, clientY) {
        const rect = this.stage.getBoundingClientRect();
        const scaleX = this.stageWidth / rect.width;
        const scaleY = this.stageHeight / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    _bindEvents() {
        const fit = () => this._fitStage();
        let fitTimer = 0;
        const fitDebounced = () => {
            clearTimeout(fitTimer);
            fitTimer = setTimeout(fit, 80);
        };

        window.addEventListener('resize', fitDebounced);
        window.addEventListener('orientationchange', () => {
            fit();
            setTimeout(fit, 200);
        });
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', fitDebounced);
        }

        const pointFromEvent = (event) => {
            const point = event.changedTouches ? event.changedTouches[0] : event;
            return this._clientToStage(point.clientX, point.clientY);
        };

        this.squirrels.forEach(squirrel => {
            squirrel.sprite.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.audioManager.unlock();
                if (!this.isPlaying || this.roundClosing) return;
                if (!this.active.has(squirrel) || !squirrel.interactable) return;
                const { x, y } = pointFromEvent(event);
                this._onGiveCoin(squirrel, x, y);
            });
        });

        this.stage.addEventListener('pointerdown', (event) => {
            if (event.target.closest('#overlay')) return;
            event.preventDefault();
            this.audioManager.unlock();
            if (!this.isPlaying || this.roundClosing) return;
            const { x, y } = pointFromEvent(event);
            this._onMiss(x, y);
        });

        this.playButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.audioManager.unlock();
            this.startRound();
        });
    }

    _elapsed() {
        return nowSeconds() - this.roundStart;
    }

    _desiredCount() {
        return this._elapsed() >= WAVE3_AT ? 2 : 1;
    }

    _hideDelay() {
        const t = this._elapsed();
        if (t >= WAVE3_AT) return 0.12 + Math.random() * 0.18;
        if (t >= WAVE2_AT) return 0.22 + Math.random() * 0.22;
        return 0.65 + Math.random() * 0.45;
    }

    _setTimer(secondsLeft) {
        const whole = Math.max(0, Math.ceil(secondsLeft));
        const mins = Math.floor(whole / 60);
        const secs = String(whole % 60).padStart(2, '0');
        this.timerValue.textContent = `${mins}:${secs}`;
        this.timerValue.classList.toggle('is-urgent', secondsLeft <= 5);
    }

    _catchPoint(squirrel) {
        const hole = squirrel.element;
        const sprite = squirrel.sprite;
        return {
            x: hole.offsetLeft + sprite.offsetLeft + sprite.offsetWidth * 0.5,
            y: hole.offsetTop + sprite.offsetTop + squirrel.offsetY + sprite.offsetHeight * 0.42
        };
    }

    _onMiss(x, y) {
        this.audioManager.play('miss');
        this.coins.missAt(x, y);
        this.scoreManager.breakCombo();
    }

    _onGiveCoin(squirrel, x, y) {
        if (squirrel.scoredThisAppearance || squirrel.isPunchPlaying) return;

        const token = squirrel.appearanceToken;
        const target = this._catchPoint(squirrel);
        this.coins.tossTo(x, y, target.x, target.y);

        squirrel.scoredThisAppearance = true;
        squirrel.setInteractable(false);
        this._cancelHideTimer(squirrel);

        this.audioManager.play('hitTarget');
        const gained = this.scoreManager.addCatch();
        this.coins.floatText(target.x - 18, target.y - 24, `+${gained}`);

        if (this.scoreManager.stash >= STASH_GOAL) {
            this._scheduleEnd(true);
        }

        squirrel.playPunch(false, () => {
            if (squirrel.appearanceToken !== token) return;
            this.audioManager.play('stars');
            this._startHideTimer(squirrel, token, HIDE_AFTER_CATCH_DELAY);
        });
    }

    _pickFree() {
        const busy = new Set(
            [...this.active, ...this.hiding].map(squirrel => squirrel.index)
        );
        const free = this.squirrels.filter(squirrel => !busy.has(squirrel.index));
        if (free.length === 0) return null;
        return free[Math.floor(Math.random() * free.length)];
    }

    _fillSpawns() {
        if (!this.isPlaying || this.roundClosing) return;
        while (this.active.size < this._desiredCount()) {
            const squirrel = this._pickFree();
            if (!squirrel) break;
            this._appear(squirrel);
        }
    }

    _appear(squirrel) {
        const token = ++this.appearanceSeq;
        squirrel.appearanceToken = token;
        squirrel.scoredThisAppearance = false;
        this.active.add(squirrel);
        squirrel.setInteractable(true);
        squirrel.playStatic();
        this.audioManager.play('show');

        squirrel.move(true, () => {
            if (squirrel.appearanceToken !== token) return;
            this._startHideTimer(squirrel, token, this._hideDelay());
        });
    }

    _startHideTimer(squirrel, token, delay) {
        this._cancelHideTimer(squirrel);
        squirrel.hideTimer = setTimeout(() => {
            squirrel.hideTimer = null;
            if (squirrel.appearanceToken !== token) return;
            this.audioManager.play('hide');
            this._retreat(squirrel, token, !squirrel.scoredThisAppearance);
        }, delay * 1000);
    }

    _retreat(squirrel, token, missed) {
        this._cancelHideTimer(squirrel);
        squirrel.setInteractable(false);
        squirrel.playStatic();
        this.active.delete(squirrel);
        this.hiding.add(squirrel);

        if (missed) this.scoreManager.breakCombo();

        squirrel.move(false, () => {
            this.hiding.delete(squirrel);
            if (squirrel.appearanceToken !== token) return;
            this._fillSpawns();
        });
    }

    _cancelHideTimer(squirrel) {
        if (squirrel.hideTimer) {
            clearTimeout(squirrel.hideTimer);
            squirrel.hideTimer = null;
        }
    }

    _tickRound() {
        if (!this.isPlaying) return;
        const left = ROUND_DURATION - this._elapsed();
        this._setTimer(left);
        if (this.roundClosing) {
            this.roundRaf = requestAnimationFrame(() => this._tickRound());
            return;
        }
        if (left <= 0) {
            this._endRound(this.scoreManager.stash >= STASH_GOAL);
            return;
        }
        this._fillSpawns();
        this.roundRaf = requestAnimationFrame(() => this._tickRound());
    }

    _scheduleEnd(won) {
        if (this.roundClosing) return;
        this.roundClosing = true;
        this.endTimer = setTimeout(() => this._endRound(won), WIN_END_DELAY * 1000);
    }

    _endRound(won) {
        if (!this.isPlaying && this.roundClosing && this.endTimer === null) return;
        this.isPlaying = false;
        this.roundClosing = true;
        if (this.roundRaf) {
            cancelAnimationFrame(this.roundRaf);
            this.roundRaf = 0;
        }
        if (this.endTimer) {
            clearTimeout(this.endTimer);
            this.endTimer = null;
        }

        this.squirrels.forEach(squirrel => {
            this._cancelHideTimer(squirrel);
            squirrel.appearanceToken = -1;
            squirrel.resetDown();
        });
        this.active.clear();
        this.hiding.clear();
        this.scoreManager.persist();
        this._setTimer(0);
        this._showResult(won);
    }

    _showResult(won) {
        this.overlayTitle.textContent = won ? 'Удача поймана!' : 'Ещё попытка?';
        this.overlayText.textContent = won
            ? 'Белка спрятала весь запас'
            : `Набери ${STASH_GOAL} монет за ${ROUND_DURATION} секунд — тапни по белке, чтобы отдать монету`;
        this.overlayStats.hidden = false;
        this.overlayStats.innerHTML =
            `Запас: ${this.scoreManager.stash}<br>Лучшая серия: ${this.scoreManager.bestCombo}`;
        this.playButton.textContent = 'ЕЩЁ РАЗ';
        this.overlay.classList.remove('is-hidden');
    }

    _hideOverlay() {
        this.overlay.classList.add('is-hidden');
    }

    startRound() {
        if (this.endTimer) {
            clearTimeout(this.endTimer);
            this.endTimer = null;
        }
        this._hideOverlay();
        this.isPlaying = true;
        this.roundClosing = false;
        this.roundStart = nowSeconds();
        this.appearanceSeq += 1;
        this.scoreManager.reset();
        this._setTimer(ROUND_DURATION);
        this.squirrels.forEach(squirrel => squirrel.resetDown());
        this.active.clear();
        this.hiding.clear();
        this._fillSpawns();
        if (this.roundRaf) cancelAnimationFrame(this.roundRaf);
        this.roundRaf = requestAnimationFrame(() => this._tickRound());
    }
}

Atlas.load().then(() => {
    const game = new HelpTheSquirrelGame();
    game._applyWorldArt();
    if (FLAG_ON(QUERY.autostart) && QUERY.autostart !== undefined) {
        game.audioManager.unlock();
        game.startRound();
    }
}).catch((error) => {
    console.error('Failed to load sprite atlases', error);
});

