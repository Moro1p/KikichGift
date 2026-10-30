// ========== ГЛОБАЛЬНЫЕ НАСТРОЙКИ ==========
const CONFIG = {
  COLUMNS: {
    ROWS: 30,
    COLS: 20,
    SPEED: 6,
    SLOWDOWN_MS: 1200,
  },
  DECODER: {
    INTERVAL_MS: 100,
    MIN_REPLACEMENTS: 1,
    MAX_REPLACEMENTS: 2,
  },
  HEART: {
    CANVAS_WIDTH: 1200,
    CANVAS_HEIGHT: 1200,

    HEART_SIZE: 1000,
    CHAIN_SIZE: 950,

    BEAT_FAST: 1.3,
    BEAT_SCALE: 0.12,
    SWING_AMPLITUDE: 0.07,
    SWING_SPEED: 0.5,

    T_SLOWING: 4000,
    T_WHITE: 2500,
    T_SHED: 2500,
    BEAT_SLOW: 0.5,
    SHED_DISTANCE: 600,
    SHED_ROTATION: 0.7,

    AUTO_FINALE: true,
    AUTO_FINALE_DELAY: 2500,

    IMAGE_PATHS: {
      redHeart:    './assets/heart/red_heart.png',
      whiteHeart:  './assets/heart/white_heart.png',
      redChains:   './assets/heart/red_chains.png',
      whiteChains: './assets/heart/white_chains.png',
    },
  },
  FINALE: {
    SHAKE_TIMES: 4,
    SHAKE_DURATION: 80,
    SHAKE_ROUNDS: 3,
    FLASH_HOLD_MS: 250,
    FLASH_OUT_MS: 800,
    SOFT_FADE_OUT_MS: 500,
  },
};

// ========== ХЕЛПЕРЫ ==========
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};

function fadeAudio(audio, targetVolume, durationMs) {
  return new Promise((resolve) => {
    const startVolume = audio.volume;
    const startTime = performance.now();
    function step(now) {
      const t = Math.min((now - startTime) / durationMs, 1);
      audio.volume = Math.max(0, Math.min(1, startVolume + (targetVolume - startVolume) * t));
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        if (targetVolume <= 0.001) {
          try { audio.pause(); audio.currentTime = 0; } catch (_) {}
        }
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}

// ========== DOM ==========
const elements = {
  backLeft:  document.getElementById('backleftColumn'),
  backRight: document.getElementById('backrightColumn'),
  left:      document.getElementById('leftColumn'),
  right:     document.getElementById('rightColumn'),
  heart:     document.getElementById('heartCanvas'),
  flash:     document.getElementById('flash'),
  carousel:  document.getElementById('carouselContainer'),
  bgGlow:    document.getElementById('bgGlow'),
  splash:    document.getElementById('splash'),
};

function applyCanvasSizes() {
  const h = window.innerHeight;
  elements.backLeft.width = 150;
  elements.backLeft.height = Math.floor(h * 0.7);
  elements.backRight.width = 150;
  elements.backRight.height = Math.floor(h * 0.7);
  elements.left.width = 300;
  elements.left.height = h;
  elements.right.width = 300;
  elements.right.height = h;
  elements.heart.width  = CONFIG.HEART.CANVAS_WIDTH;
  elements.heart.height = CONFIG.HEART.CANVAS_HEIGHT;
}
applyCanvasSizes();

const ctx = {
  backLeft:  elements.backLeft.getContext('2d'),
  backRight: elements.backRight.getContext('2d'),
  left:      elements.left.getContext('2d'),
  right:     elements.right.getContext('2d'),
  heart:     elements.heart.getContext('2d'),
};

window.addEventListener('resize', applyCanvasSizes);

// ========== ЗВУКИ ==========
const sounds = {
  beat_in:         new Audio('./assets/sounds/heartbeat_in.mp3'),
  beat_out:        new Audio('./assets/sounds/heartbeat_out.mp3'),
  crack:           new Audio('./assets/sounds/crack.mp3'),
  flash:           new Audio('./assets/sounds/flash.mp3'),
  backgroundStart: new Audio('./assets/sounds/background_start.mp3'),
  backgroundSoft:  new Audio('./assets/sounds/background_soft.mp3'),
  backgroundEnd:   new Audio('./assets/sounds/background_end.mp3'),
  slide_sound:     new Audio('./assets/sounds/slide_sound.mp3'),
};

sounds.backgroundStart.loop = true;
sounds.backgroundStart.volume = 0.3;

sounds.backgroundSoft.loop = false;
sounds.backgroundSoft.volume = 0.6;

sounds.backgroundEnd.loop = true;
sounds.backgroundEnd.volume = 0.5;

sounds.beat_in.volume = 0.5;
sounds.beat_out.volume = 0.5;
sounds.crack.volume = 0.7;
sounds.flash.volume = 0.5;
sounds.slide_sound.volume = 1;

// ========== АУДИО-РАЗБЛОКИРОВКА ==========
let audioUnlocked = false;
let audioPrimed = false;
let audioPlayPromise = null;

/**
 * «Будит» один аудиоэлемент (iOS Safari требует запустить каждый
 * <audio> хотя бы раз из user-gesture).
 */
function primeOne(audio) {
  try {
    const wasMuted = audio.muted;
    audio.muted = true;
    const p = audio.play();
    if (p && p.then) {
      p.then(() => {
        try { audio.pause(); audio.currentTime = 0; } catch (_) {}
        audio.muted = wasMuted;
      }).catch(() => {
        audio.muted = wasMuted;
      });
    } else {
      try { audio.pause(); audio.currentTime = 0; } catch (_) {}
      audio.muted = wasMuted;
    }
  } catch (_) {}
}

function primeAllSounds() {
  if (audioPrimed) return;
  audioPrimed = true;
  Object.values(sounds).forEach((s) => {
    if (s === sounds.backgroundStart) return;
    primeOne(s);
  });
}

function unlockAudio() {
  if (audioUnlocked) return;
  primeAllSounds();

  if (heartState.isFinale || heartState.isTransforming) {
    audioUnlocked = true;
    return;
  }
  if (audioPlayPromise) return;

  const p = sounds.backgroundStart.play();
  if (p && p.then) {
    audioPlayPromise = p;
    p.then(() => {
      audioUnlocked = true;
      audioPlayPromise = null;
    }).catch(() => {
      audioPlayPromise = null;
    });
  } else {
    audioUnlocked = true;
  }
}

document.addEventListener('pointerdown', unlockAudio, { passive: true });
document.addEventListener('touchstart', unlockAudio, { passive: true });
document.addEventListener('keydown', unlockAudio);

// ========== СТОЛБЫ ==========
const state = {
  timeOffset: 0,
  columnsHidden: false,
  isSlowingDown: false,
  slowdownElapsed: 0,
  slowdownFactor: 1,
};
const columnMatrices = { backLeft: [], backRight: [], left: [], right: [] };

function buildColumnMatrix(rows = CONFIG.COLUMNS.ROWS, cols = CONFIG.COLUMNS.COLS) {
  const m = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(Math.floor(Math.random() * 10));
    m.push(row);
  }
  return m;
}
columnMatrices.backLeft  = buildColumnMatrix();
columnMatrices.backRight = buildColumnMatrix();
columnMatrices.left      = buildColumnMatrix();
columnMatrices.right     = buildColumnMatrix();

function getColumnsVisuals() {
  const H = CONFIG.HEART;
  let whiteness, beatHz;
  const t = heartState.transformElapsed;

  if (!heartState.isTransforming) {
    whiteness = 0;
    beatHz = H.BEAT_FAST;
  } else if (t < H.T_SLOWING) {
    const k = t / H.T_SLOWING;
    whiteness = smoothstep(k);
    beatHz = lerp(H.BEAT_FAST, H.BEAT_SLOW, k);
  } else {
    whiteness = 1;
    beatHz = H.BEAT_SLOW;
  }

  return {
    speedFactor: beatHz / H.BEAT_FAST,
    r: 255,
    g: Math.round(255 * whiteness),
    b: Math.round(255 * whiteness),
  };
}

function drawColumn(c, direction, matrix, scaleFactor, visuals) {
  const w = c.canvas.width, h = c.canvas.height;
  c.clearRect(0, 0, w, h);

  const rows = matrix.length, cols = matrix[0].length;
  const baseFontSize = 20 * scaleFactor;
  const a = 100 * scaleFactor, b = 40 * scaleFactor;
  const startY = 40 * scaleFactor;
  const centerX = w / 2;
  const rowHeight = (h - 80 * scaleFactor) / rows;
  const angleStep = (2 * Math.PI) / cols;

  const colorStr = `rgb(${visuals.r},${visuals.g},${visuals.b})`;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const angle = col * angleStep + state.timeOffset * direction;
      const x = centerX + a * Math.sin(angle);
      const y = startY + row * rowHeight + b * Math.cos(angle);
      const charScale = (0.5 + 0.5 * Math.cos(angle)) * scaleFactor;

      c.save();
      c.translate(x, y);
      c.scale(charScale, charScale);
      c.font = `${baseFontSize}px "Share Tech Mono", monospace`;
      c.fillStyle = colorStr;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(matrix[row][col], 0, 0);
      c.restore();
    }
  }
}

let columnRafId = null;
let lastColumnTime = performance.now();

function animateColumns(now) {
  if (state.columnsHidden) return;
  const dt = Math.min((now - lastColumnTime) / 1000, 0.05);
  lastColumnTime = now;

  if (state.isSlowingDown) {
    state.slowdownElapsed += dt;
    const k = Math.min(
      state.slowdownElapsed / (CONFIG.COLUMNS.SLOWDOWN_MS / 1000),
      1
    );
    state.slowdownFactor = 1 - smoothstep(k);
    if (k >= 1) {
      state.slowdownFactor = 0;
      if (columnRafId) { cancelAnimationFrame(columnRafId); columnRafId = null; }
      return;
    }
  }

  const visuals = getColumnsVisuals();
  state.timeOffset +=
    dt * CONFIG.COLUMNS.SPEED * visuals.speedFactor * state.slowdownFactor;

  drawColumn(ctx.backLeft,   1, columnMatrices.backLeft,  0.6, visuals);
  drawColumn(ctx.backRight, -1, columnMatrices.backRight, 0.6, visuals);
  drawColumn(ctx.left,       1, columnMatrices.left,      1.0, visuals);
  drawColumn(ctx.right,     -1, columnMatrices.right,     1.0, visuals);

  columnRafId = requestAnimationFrame(animateColumns);
}

function startColumns() {
  if (columnRafId) return;
  lastColumnTime = performance.now();
  columnRafId = requestAnimationFrame(animateColumns);
}

function freezeColumns() {
  if (columnRafId) { cancelAnimationFrame(columnRafId); columnRafId = null; }
}

function slowColumnsToStop(durationMs = CONFIG.COLUMNS.SLOWDOWN_MS) {
  if (state.columnsHidden || state.isSlowingDown) return;
  state.isSlowingDown = true;
  state.slowdownElapsed = 0;
  if (!columnRafId) {
    lastColumnTime = performance.now();
    columnRafId = requestAnimationFrame(animateColumns);
  }
}

function stopColumns() {
  state.columnsHidden = true;
  freezeColumns();
}

startColumns();

// ========== СЕРДЦЕ ==========
const heartImages = {
  redHeart:    new Image(),
  whiteHeart:  new Image(),
  redChains:   new Image(),
  whiteChains: new Image(),
};
heartImages.redHeart.src    = CONFIG.HEART.IMAGE_PATHS.redHeart;
heartImages.whiteHeart.src  = CONFIG.HEART.IMAGE_PATHS.whiteHeart;
heartImages.redChains.src   = CONFIG.HEART.IMAGE_PATHS.redChains;
heartImages.whiteChains.src = CONFIG.HEART.IMAGE_PATHS.whiteChains;

const heartState = {
  isTransforming: false,
  transformElapsed: 0,
  transformationDone: false,
  isFinale: false,

  beatPhase: 0,
  prevBeatPhase: 0,
  swingPhase: 0,
  isHovered: false,
  beatToggle: false,

  lastTime: performance.now(),
};

let heartRafId = null;
let imagesReady = false;
let imagesLoaded = 0;
const totalImages = 4;

Object.values(heartImages).forEach((img) => {
  const done = () => {
    imagesLoaded++;
    if (imagesLoaded === totalImages) {
      imagesReady = true;
      startHeartAnimation();
    }
  };
  if (img.complete && img.naturalWidth > 0) done();
  else {
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', () => {
      console.warn('[heart] не удалось загрузить:', img.src);
      done();
    }, { once: true });
  }
});

function startHeartAnimation() {
  if (heartRafId) return;
  heartState.lastTime = performance.now();
  heartRafId = requestAnimationFrame(heartLoop);
}

function heartLoop(now) {
  const dt = Math.min((now - heartState.lastTime) / 1000, 0.05);
  heartState.lastTime = now;
  const dtMs = dt * 1000;
  const H = CONFIG.HEART;

  if (heartState.isTransforming && !heartState.transformationDone) {
    heartState.transformElapsed += dtMs;
    const totalT = H.T_SLOWING + H.T_WHITE + H.T_SHED;
    if (heartState.transformElapsed >= totalT) {
      heartState.transformElapsed = totalT;
      heartState.transformationDone = true;
      elements.heart.classList.add('ready');
      if (H.AUTO_FINALE && !heartState.isFinale) {
        setTimeout(() => {
          if (!heartState.isFinale) startFinale();
        }, H.AUTO_FINALE_DELAY);
      }
    }
  }

  const t = heartState.transformElapsed;

  let beatHz, whiteness, chainsFall;

  if (!heartState.isTransforming) {
    beatHz = H.BEAT_FAST;
    whiteness = 0;
    chainsFall = 0;
  } else if (t < H.T_SLOWING) {
    const k = t / H.T_SLOWING;
    beatHz = lerp(H.BEAT_FAST, H.BEAT_SLOW, k);
    whiteness = smoothstep(k);
    chainsFall = 0;
  } else if (t < H.T_SLOWING + H.T_WHITE) {
    beatHz = H.BEAT_SLOW;
    whiteness = 1;
    chainsFall = 0;
  } else if (t < H.T_SLOWING + H.T_WHITE + H.T_SHED) {
    const k = (t - H.T_SLOWING - H.T_WHITE) / H.T_SHED;
    beatHz = H.BEAT_SLOW;
    whiteness = 1;
    chainsFall = smoothstep(k);
  } else {
    beatHz = H.BEAT_SLOW;
    whiteness = 1;
    chainsFall = 1;
  }

  const swingSpeed = H.SWING_SPEED * (beatHz / H.BEAT_FAST);
  heartState.swingPhase += swingSpeed * dt;
  const swing = Math.sin(heartState.swingPhase * Math.PI * 2) * H.SWING_AMPLITUDE;

  heartState.prevBeatPhase = heartState.beatPhase;
  heartState.beatPhase += beatHz * dt;

  const prevBeat = Math.floor(heartState.prevBeatPhase - 0.25);
  const currBeat = Math.floor(heartState.beatPhase - 0.25);
  if (currBeat > prevBeat && heartState.isHovered && !heartState.isFinale) {
    const snd = heartState.beatToggle ? sounds.beat_out : sounds.beat_in;
    heartState.beatToggle = !heartState.beatToggle;
    snd.currentTime = 0;
    snd.play().catch(() => {});
  }

  const beat = 1 + H.BEAT_SCALE * Math.sin(heartState.beatPhase * Math.PI * 2);

  drawHeartScene(whiteness, chainsFall, beat, swing);

  if (!heartState.isFinale) {
    heartRafId = requestAnimationFrame(heartLoop);
  } else {
    heartRafId = null;
  }
}

function drawHeartScene(whiteness, chainsFall, beat, swing) {
  const c = ctx.heart;
  const W = CONFIG.HEART.CANVAS_WIDTH;
  const Hh = CONFIG.HEART.CANVAS_HEIGHT;
  const cx = W / 2;
  const cy = Hh / 2;

  c.clearRect(0, 0, W, Hh);

  // Фоновое свечение — на весь экран через CSS-переменную
  const glowPulse = 0.5 + 0.5 * Math.sin(heartState.beatPhase * Math.PI * 2);
  const glowIntensity = glowPulse * (1 - whiteness * 0.7);
  const gG = Math.round(255 * whiteness);
  const gB = Math.round(255 * whiteness);
  elements.bgGlow.style.opacity = (0.55 * glowIntensity).toFixed(3);
  elements.bgGlow.style.setProperty('--glow-rgb', `255, ${gG}, ${gB}`);

  if (!imagesReady) return;

  c.save();
  c.translate(cx, cy);
  c.rotate(swing);
  c.scale(beat, beat);
  const hs = CONFIG.HEART.HEART_SIZE;

  c.globalAlpha = 1 - whiteness;
  c.drawImage(heartImages.redHeart, -hs / 2, -hs / 2, hs, hs);

  c.globalAlpha = whiteness;
  c.drawImage(heartImages.whiteHeart, -hs / 2, -hs / 2, hs, hs);

  c.restore();

  if (chainsFall < 1) {
    const cs = CONFIG.HEART.CHAIN_SIZE;
    const fallY = chainsFall * CONFIG.HEART.SHED_DISTANCE;
    const fallR = chainsFall * CONFIG.HEART.SHED_ROTATION;
    const fallOpacity = 1 - chainsFall * chainsFall;

    c.save();
    c.translate(cx, cy);
    c.rotate(swing);
    c.scale(beat, beat);
    c.translate(0, fallY);
    c.rotate(fallR);

    c.globalAlpha = fallOpacity * (1 - whiteness);
    c.drawImage(heartImages.redChains, -cs / 2, -cs / 2, cs, cs);

    c.globalAlpha = fallOpacity * whiteness;
    c.drawImage(heartImages.whiteChains, -cs / 2, -cs / 2, cs, cs);

    c.restore();
  }
}

// ========== HOVER / TAP ==========
elements.heart.addEventListener('mouseenter', () => {
  if (heartState.isFinale) return;
  heartState.isHovered = true;
});
elements.heart.addEventListener('mouseleave', () => {
  heartState.isHovered = false;
});
elements.heart.addEventListener('pointerdown', () => {
  if (heartState.isFinale) return;
  heartState.isHovered = true;
}, { passive: true });

// ========== ЛОГИКА КЛИКА ==========
function handleHeartTap() {
  if (heartState.isFinale) return;
  unlockAudio();

  if (!heartState.isTransforming) {
    heartState.isTransforming = true;
    heartState.transformElapsed = 0;
    startTransformationAudio();
    return;
  }

  if (heartState.transformationDone && !CONFIG.HEART.AUTO_FINALE) {
    startFinale();
  }
}

elements.heart.addEventListener('click', handleHeartTap);
elements.heart.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleHeartTap();
  }
});

function startTransformationAudio() {
  if (!audioUnlocked) unlockAudio();

  fadeAudio(sounds.backgroundStart, 0, CONFIG.HEART.T_SLOWING);

  try {
    sounds.backgroundSoft.currentTime = 0;
    sounds.backgroundSoft.volume = 0.6;
    sounds.backgroundSoft.play().catch(() => {});
  } catch (_) {}
}

// ========== ФИНАЛ ==========
async function startFinale() {
  if (heartState.isFinale) return;
  heartState.isFinale = true;

  slowColumnsToStop();

  elements.bgGlow.style.opacity = '0';

  sounds.backgroundStart.pause();
  sounds.backgroundStart.currentTime = 0;
  sounds.backgroundStart.volume = 0;

  if (!sounds.backgroundSoft.paused) {
    fadeAudio(sounds.backgroundSoft, 0, CONFIG.FINALE.SOFT_FADE_OUT_MS);
  }

  for (let i = 0; i < CONFIG.FINALE.SHAKE_ROUNDS; i++) {
    sounds.crack.currentTime = 0;
    sounds.crack.play().catch(() => {});
    await shakeHeartElement(CONFIG.FINALE.SHAKE_TIMES, CONFIG.FINALE.SHAKE_DURATION);
    await sleep(40);
  }

  sounds.flash.currentTime = 0;
  sounds.flash.play().catch(() => {});
  document.body.style.backgroundColor = 'white';
  document.body.style.color = 'black';

  elements.flash.style.transition = 'opacity 0.1s ease-in';
  elements.flash.style.opacity = '1';

  await sleep(CONFIG.FINALE.FLASH_HOLD_MS);

  elements.flash.style.transition = `opacity ${CONFIG.FINALE.FLASH_OUT_MS}ms ease-out`;
  elements.flash.style.opacity = '0';

  elements.heart.style.display = 'none';
  elements.left.style.display = 'none';
  elements.right.style.display = 'none';
  elements.backLeft.style.display = 'none';
  elements.backRight.style.display = 'none';
  elements.bgGlow.style.display = 'none';
  stopColumns();

  sounds.backgroundEnd.play().catch(() => {});
  loadCarouselContent();
  elements.carousel.classList.remove('hidden');
}

function shakeHeartElement(times, duration) {
  return new Promise((resolve) => {
    let count = 0;
    const base = 'translate(-50%, -50%)';
    function step() {
      if (count >= times) {
        elements.heart.style.transform = base;
        resolve();
        return;
      }
      const dx = (Math.random() - 0.5) * 24;
      const dy = (Math.random() - 0.5) * 24;
      elements.heart.style.transform = `${base} translate(${dx}px, ${dy}px)`;
      count++;
      setTimeout(() => {
        elements.heart.style.transform = base;
        setTimeout(step, 20);
      }, duration);
    }
    step();
  });
}

// ========== ДЕКОДЕР ==========
const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
const randomChar = () => charset[Math.floor(Math.random() * charset.length)];
const randomString = (len) => Array.from({ length: len }, randomChar).join('');

let decodingInterval = null;

function resetDecoding() {
  document.querySelectorAll('.decoding-text').forEach((el) => {
    const target = el.getAttribute('data-target') || '';
    el.textContent = randomString(target.length);
  });
  if (decodingInterval) clearInterval(decodingInterval);
  initDecodingForSlides();
}

function initDecodingForSlides() {
  if (decodingInterval) clearInterval(decodingInterval);
  const els = document.querySelectorAll('.decoding-text');
  if (els.length === 0) return;

  const states = [];
  els.forEach((el) => {
    const target = el.getAttribute('data-target') || '';
    const current = randomString(target.length).split('');
    el.textContent = current.join('');
    states.push({ element: el, target, current });
  });

  const { INTERVAL_MS, MIN_REPLACEMENTS, MAX_REPLACEMENTS } = CONFIG.DECODER;
  const replacementRange = MAX_REPLACEMENTS - MIN_REPLACEMENTS + 1;

  decodingInterval = setInterval(() => {
    let allFinished = true;
    states.forEach((s) => {
      const { element, target, current } = s;
      const mismatch = [];
      for (let i = 0; i < target.length; i++) {
        if (current[i] !== target[i]) mismatch.push(i);
      }
      if (mismatch.length > 0) {
        allFinished = false;
        let replacements =
          Math.floor(Math.random() * replacementRange) + MIN_REPLACEMENTS;
        replacements = Math.min(replacements, mismatch.length);
        for (let i = mismatch.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [mismatch[i], mismatch[j]] = [mismatch[j], mismatch[i]];
        }
        for (let k = 0; k < replacements; k++) {
          current[mismatch[k]] = target[mismatch[k]];
        }
        element.textContent = current.join('');
      }
    });
    if (allFinished) {
      clearInterval(decodingInterval);
      decodingInterval = null;
    }
  }, INTERVAL_MS);
}

// ========== КАРУСЕЛЬ ==========
function loadCarouselContent() {
  const slidesContainer = document.querySelector('.slides');
  slidesContainer.innerHTML = '';

  const photos = [
    { src: './assets/photos/photo1.jpg', comment: '26.04.2025 — день который я никогда в своей жизни не забуду' },
    { src: './assets/photos/photo2.jpg', comment: 'ain’t nobody else like you' },
    { src: './assets/photos/photo3.jpg', comment: 'and if you go..i wanna go with you' },
  ];

  photos.forEach((photo) => {
    const slide = document.createElement('div');
    slide.className = 'slide';

    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = 'Фото';
    img.loading = 'lazy';

    const p = document.createElement('p');
    p.className = 'decoding-text';
    p.setAttribute('data-target', photo.comment);
    p.textContent = randomString(photo.comment.length);

    slide.appendChild(img);
    slide.appendChild(p);
    slidesContainer.appendChild(slide);
  });

  initDecodingForSlides();

  elements.carousel.addEventListener('click', (e) => {
    const isPrev = e.target.classList.contains('prev');
    const isNext = e.target.classList.contains('next');
    if (!isPrev && !isNext) return;

    resetDecoding();

    sounds.slide_sound.currentTime = 0;
    sounds.slide_sound.play().catch(() => {});

    const step = slidesContainer.clientWidth + 20;
    slidesContainer.scrollBy({
      left: isPrev ? -step : step,
      behavior: 'smooth',
    });
  });
}

// ========== СТАРТОВАЯ ЗАГЛУШКА ==========
(function setupSplash() {
  const splash = elements.splash;
  if (!splash) return;

  let dismissed = false;

  function dismissSplash() {
    if (dismissed) return;
    dismissed = true;

    // Вызывается синхронно из user-gesture — браузер разрешает play()
    unlockAudio();

    splash.classList.add('hidden');

    // На случай, если unlockAudio попал в «уже разблокировано»,
    // но музыка по какой-то причине не заиграла — пробуем ещё раз.
    if (!heartState.isFinale && !heartState.isTransforming) {
      const p = sounds.backgroundStart.play();
      if (p && p.catch) p.catch(() => {});
    }
  }

  splash.addEventListener('pointerdown', dismissSplash, { passive: true });
  splash.addEventListener('touchstart',  dismissSplash, { passive: true });
  splash.addEventListener('click',       dismissSplash);
  splash.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dismissSplash();
    }
  });
})();

// ========== PAUSE ON HIDDEN ==========
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (heartRafId) {
      cancelAnimationFrame(heartRafId);
      heartRafId = null;
    }
  } else {
    if (!heartState.isFinale && imagesReady && !heartRafId) {
      heartState.lastTime = performance.now();
      heartRafId = requestAnimationFrame(heartLoop);
    }
  }
});