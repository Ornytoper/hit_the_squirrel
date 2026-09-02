const LANDSCAPE_STAGE = { width: 1280, height: 720 };
const PORTRAIT_STAGE = { width: 720, height: 1280 };
const HIDE_AFTER_HIT_DELAY = 0.35;
const MIN_RANDOM_TIMEOUT = 0.1;
const MAX_RANDOM_TIMEOUT = 0.5;
const SCREAM_SOUND_MAX_CHANCE = 0.5;
const FRAME_DURATION = 0.05;
const MOVE_DURATION = 0.3;
const MOVE_OFFSET_Y = 170;
const HAMMER_Z_ROTATE = -40;
const HAMMER_HIT_DURATION = 0.1;
const HAMMER_HIT_OFFSET_X = 50.0;
const HIGH_SCORE_KEY = 'hitSquirrelMiniGameHighScore';
const LEGACY_HIGH_SCORE_KEY = 'hitSquirrelHighScore';

const IS_SAFARI = /^((?!chrome|chromium|crios|fxios|edgios|android).)*safari/i.test(navigator.userAgent);
const STAR_COUNT = IS_SAFARI ? 4 : 7;
const MAX_ACTIVE_SFX = 8;
const DEBUG_FLAGS = Object.assign(
    { sound: true, stars: true, squirrel: true, hammer: true },
    Object.fromEntries(new URLSearchParams(location.search).entries())
);
const FLAG_ON = v => v !== '0' && v !== 'false' && v !== false;

const ANIMATIONS = {
    idle: ['idle-1', 'idle-2', 'idle-3', 'idle-4'],
    aftershock: ['aftershock-1', 'aftershock-2', 'aftershock-3', 'aftershock-4'],
    punch: ['punch-1', 'punch-2', 'punch-3', 'punch-4']
};

const Atlas = {
    size: 2048,
    urls: [
        'assets/atlases/atlas-0.webp',
        'assets/atlases/atlas-1.webp',
        'assets/atlases/atlas-2.webp'
    ],
    frames: null,
    images: [],
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
        if (this.spriteAssets) return;
        this.spriteAssets = Promise.all([
            fetch('assets/sounds/sprites.json').then(response => response.json()),
            fetch('assets/sounds/sprites.m4a').then(response => response.arrayBuffer())
        ]);
    }

    unlock() {
        if (this.unlocked) return;
        this.unlocked = true;

        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
            this.ctx = new Ctx();
            this.ctx.resume().catch(() => {});
            this._loadSprite();
        }

        this.playMusic();
    }

    _loadSprite() {
        if (this.spriteReady) return this.spriteReady;

        this.preload();
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
        this.offsetY = MOVE_OFFSET_Y;
        this._setOffset(MOVE_OFFSET_Y);
        this._syncHitbox();
    }

    setInteractable(state) {
        this.interactable = state;
        this._syncHitbox();
    }

    playStatic() {
        this._stopAnim();
        this.isPunchPlaying = false;
        this._setFrame('staticSquirrel');
    }

    playIdle(yoyo, onComplete) {
        this.playAnimation(ANIMATIONS.idle, yoyo, onComplete);
    }

    playShock(yoyo, onComplete) {
        this.playAnimation(ANIMATIONS.aftershock, yoyo, onComplete);
    }

    playPunch(yoyo, onComplete) {
        if (this.isPunchPlaying) return false;

        this.isPunchPlaying = true;
        this.playAnimation(ANIMATIONS.punch, yoyo, () => {
            this.isPunchPlaying = false;
            if (onComplete) onComplete();
        });
        return true;
    }

    playAnimation(frames, yoyo, onComplete) {
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
            }, FRAME_DURATION * 1000);
        };

        showFrame();

        this.animCancel = () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }

    _setFrame(name) {
        if (IS_SAFARI) {
            const url = `assets/frames/${name}.webp`;
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
    }

    _setOffset(offsetY) {
        this.offsetY = offsetY;
        this.sprite.style.transform = `translateY(${offsetY}px)`;
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

class HammerPlayer {
    constructor(stage, particlesRoot) {
        this.element = document.getElementById('hammer');
        this.particlesRoot = particlesRoot;
        this.canvas = particlesRoot.querySelector('#particles-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.stars = [];
        this.rafId = 0;
        this.stage = stage;
        this.animCancel = null;
        this.resetHammer();
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

    playHitAtStagePosition(x, y) {
        if (!FLAG_ON(DEBUG_FLAGS.hammer)) return;
        this._stopAnim();

        const strikeX = x + (this.element.offsetWidth + HAMMER_HIT_OFFSET_X);

        this.element.style.left = `${strikeX}px`;
        this.element.style.top = `${y}px`;
        this.element.style.opacity = '1';
        this.element.style.transform = 'translate(-75%, -100%) rotate(0deg)';

        this.animCancel = tween(HAMMER_HIT_DURATION, t => {
            this.element.style.transform =
                `translate(-75%, -100%) rotate(${HAMMER_Z_ROTATE * t}deg)`;
        }, () => {
            const starX = strikeX - (this.element.offsetWidth - HAMMER_HIT_OFFSET_X);
            this._spawnStars(starX, y);
            this.resetHammer();
        });
    }

    resetHammer() {
        this.element.style.opacity = '0';
        this.element.style.transform = 'translate(-75%, -100%) rotate(0deg)';
    }

    _spawnStars(x, y) {
        if (!this.ctx) return;
        if (!FLAG_ON(DEBUG_FLAGS.stars)) return;
        if (this.stars.length > 0) return;

        for (let i = 0; i < STAR_COUNT; i++) {
            const angle = (Math.PI * 2 * i) / 7 + Math.random() * 0.4;
            const distance = 40 + Math.random() * 50;
            this.stars.push({
                x, y,
                vx: Math.cos(angle) * distance,
                vy: Math.sin(angle) * distance,
                size: 16 + Math.random() * 8,
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

            this.stars = this.stars.filter(star => {
                const age = (now - star.born) / 450;
                if (age >= 1) return false;

                const t = 1 - Math.pow(1 - age, 2);
                const cx = star.x + star.vx * t;
                const cy = star.y + star.vy * t;
                const scale = 1 - age * 0.8;
                const rot = age * 2.1;
                const s = star.size * scale;

                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(rot);
                ctx.globalAlpha = 1 - age;
                ctx.fillStyle = '#fff8c8';
                ctx.beginPath();
                const pts = [[0,-0.5],[0.11,-0.15],[0.48,-0.15],[0.18,0.07],[0.29,0.41],[0,0.2],[-0.29,0.41],[-0.18,0.07],[-0.48,-0.15],[-0.11,-0.15]];
                ctx.moveTo(pts[0][0]*s, pts[0][1]*s);
                for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0]*s, pts[i][1]*s);
                ctx.closePath();
                ctx.fill();
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

    _stopAnim() {
        if (this.animCancel) {
            this.animCancel();
            this.animCancel = null;
        }
    }
}

class ScoreManager {
    constructor() {
        this.score = 0;
        this.highScore = this._loadHighScore();
        this.scoreElement = document.getElementById('score-value');
        this.highScoreElement = document.getElementById('high-score-value');
        this.highScoreElement.textContent = this.highScore;
        this.scoreElement.textContent = '0';
        window.addEventListener('pagehide', () => this._persistHighScore());
    }

    addScore() {
        this.score += 1;
        this.scoreElement.textContent = this.score;

        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.highScoreElement.textContent = this.highScore;
        }
    }

    reset() {
        this.score = 0;
        this.scoreElement.textContent = '0';
    }

    _loadHighScore() {
        const current = parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10);
        if (!Number.isNaN(current)) return current;

        const legacy = parseInt(localStorage.getItem(LEGACY_HIGH_SCORE_KEY), 10);
        return Number.isNaN(legacy) ? 0 : legacy;
    }

    _persistHighScore() {
        if (this.score >= this.highScore) {
            localStorage.setItem(HIGH_SCORE_KEY, String(this.score));
        } else {
            localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
        }
    }
}

class HitTheSquirrelGame {
    constructor() {
        this.stage = document.getElementById('stage');
        this.audioManager = new AudioManager();
        this.hammer = new HammerPlayer(this.stage, document.getElementById('particles'));
        this.scoreManager = new ScoreManager();
        this.squirrels = [];
        this.currentRoundId = 0;
        this.currentSquirrel = null;
        this.hideTimer = null;
        this.isCurrentSquirrelScored = false;
        this.isPlaying = false;
        this.stageWidth = LANDSCAPE_STAGE.width;
        this.stageHeight = LANDSCAPE_STAGE.height;
        this.isPortrait = false;
        this._artKey = '';

        this._initSquirrels();
        this._bindEvents();
        this._fitStage();
        this.audioManager.preload();
    }

    _applyWorldArt() {
        if (!Atlas.frames) return;
        const bgFit = this.isPortrait ? 'cover-y40' : 'fill';
        Atlas.paint(document.getElementById('background'), 'HitTheSquirrelMiniGame_Bg', bgFit);
        Atlas.paint(document.getElementById('hammer'), 'HammerSquirrelMiniGame', 'contain-bottom');
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
                if (!this.isPlaying) return;
                if (squirrel !== this.currentSquirrel || !squirrel.interactable) return;
                const { x, y } = pointFromEvent(event);
                this._onTouchSquirrel(x, y);
            });
        });

        this.stage.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            this.audioManager.unlock();
            if (!this.isPlaying) return;
            const { x, y } = pointFromEvent(event);
            this._onMiss(x, y);
        });
    }

    _onMiss(x, y) {
        this.audioManager.play('miss');
        this.hammer.playHitAtStagePosition(x, y);
    }

    _onTouchSquirrel(x, y) {
        const currentSquirrel = this.currentSquirrel;
        if (!currentSquirrel) return;

        const roundId = this.currentRoundId;

        this._cancelHideTimer();
        this.hammer.playHitAtStagePosition(x, y);

        this.audioManager.play('hitTarget');
        if (Math.random() <= SCREAM_SOUND_MAX_CHANCE) {
            this.audioManager.play('scream');
        }

        if (!this.isCurrentSquirrelScored) {
            this.scoreManager.addScore();
            this.isCurrentSquirrelScored = true;
        }

        currentSquirrel.playPunch(false, () => {
            if (!this._isCurrentRound(roundId, currentSquirrel)) return;

            this.audioManager.play('stars');
            currentSquirrel.playShock(true);
            this.audioManager.play('hide');
            this._startHideTimer(roundId, currentSquirrel, HIDE_AFTER_HIT_DELAY);
        });
    }

    playGame() {
        this._cancelHideTimer();
        this.squirrels.forEach(squirrel => squirrel.setInteractable(false));
        this.isCurrentSquirrelScored = false;
        this.currentRoundId += 1;

        const roundId = this.currentRoundId;
        const squirrel = this.squirrels[Math.floor(Math.random() * this.squirrels.length)];
        this.currentSquirrel = squirrel;

        squirrel.setInteractable(true);
        squirrel.playStatic();
        this.audioManager.play('show');

        squirrel.move(true, () => {
            if (!this._isCurrentRound(roundId, squirrel)) return;

            squirrel.playIdle(false, () => {
                if (!this._isCurrentRound(roundId, squirrel)) return;
                this._startHideTimer(roundId, squirrel, this._randomTimeout());
            });
        });
    }

    _randomTimeout() {
        return MIN_RANDOM_TIMEOUT + Math.random() * (MAX_RANDOM_TIMEOUT - MIN_RANDOM_TIMEOUT);
    }

    _isCurrentRound(roundId, squirrel) {
        return this.currentRoundId === roundId && this.currentSquirrel === squirrel;
    }

    _startHideTimer(roundId, squirrel, delay) {
        this._cancelHideTimer();

        this.hideTimer = setTimeout(() => {
            this.hideTimer = null;
            if (!this._isCurrentRound(roundId, squirrel)) return;

            squirrel.setInteractable(false);
            squirrel.playStatic();
            this.currentSquirrel = null;

            squirrel.move(false, () => {
                if (this.currentRoundId !== roundId) return;
                this.playGame();
            });
        }, delay * 1000);
    }

    _cancelHideTimer() {
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
    }

    start() {
        this.isPlaying = true;
        this.scoreManager.reset();
        this.playGame();
    }
}

Atlas.load().then(() => {
    const game = new HitTheSquirrelGame();
    game.start();
}).catch((error) => {
    console.error('Failed to load sprite atlases', error);
});
