/**
 * ЭНИП-Тетрис с реальными изображениями устройств
 * Поддерживает Telegram Mini App (TMA), мобильное сенсорное и клавиатурное управление
 */

// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
  try {
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) tg.setHeaderColor('#17212b');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#0e1621');
    document.body.classList.add('tg-theme');
  } catch (e) {
    console.warn('Ошибка инициализации Telegram WebApp:', e);
  }
}

// Вибрация / Тактильный отклик через Telegram Haptic Feedback
function triggerHaptic(type = 'light') {
  if (!tg?.HapticFeedback) return;
  try {
    if (type === 'light') tg.HapticFeedback.impactOccurred('light');
    else if (type === 'medium') tg.HapticFeedback.impactOccurred('medium');
    else if (type === 'heavy') tg.HapticFeedback.impactOccurred('heavy');
    else if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
    else if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
  } catch (e) {}
}

// Звуковой синтезатор на Web Audio API (работает без внешних mp3)
class SoundFx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, endFreq = null, gainVal = 0.15) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq) {
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
      }

      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  }

  move() { this.playTone(240, 'triangle', 0.04, 200, 0.08); }
  rotate() { this.playTone(400, 'sine', 0.06, 600, 0.12); }
  drop() { this.playTone(180, 'sine', 0.08, 90, 0.2); }
  clearLine(count) {
    if (!this.enabled) return;
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.slice(0, Math.min(count + 1, 4)).forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'square', 0.1, null, 0.12), idx * 60);
    });
  }
  gameOver() {
    if (!this.enabled) return;
    this.init();
    [320, 260, 200, 140].forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sawtooth', 0.16, freq * 0.7, 0.2), idx * 110);
    });
  }
}

const sound = new SoundFx();

// Конфигурация устройств и 7 фигур тетрамино
const SHAPES = [
  {
    type: 'I',
    name: 'ЭНИП-2',
    file: 'devices/ENIP_ (1).png',
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  {
    type: 'O',
    name: 'ЭСМ',
    file: 'devices/ESM_ (1) (1).png',
    matrix: [
      [1, 1],
      [1, 1]
    ]
  },
  {
    type: 'T',
    name: 'ЭНКС-3',
    file: 'devices/ENKS_3 (1) (1).png',
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  {
    type: 'S',
    name: 'ЭНМВ',
    file: 'devices/ENMV (1) (1).png',
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ]
  },
  {
    type: 'Z',
    name: 'ЭНЛЗ',
    file: 'devices/ENLZ_ (1) (1).png',
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ]
  },
  {
    type: 'J',
    name: 'ЭНМИ-4',
    file: 'devices/ENMI_4 (1) (1).png',
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  {
    type: 'L',
    name: 'БКВ',
    file: 'devices/BKV_ (1) (1).png',
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ]
  }
];

// Предзагрузка изображений
const loadedImages = [];
let imagesReady = 0;

SHAPES.forEach((shape, index) => {
  const img = new Image();
  img.src = encodeURI(shape.file);
  img.onload = () => {
    imagesReady++;
    if (imagesReady === SHAPES.length) {
      console.log('Все изображения устройств успешно загружены!');
      game.draw();
    }
  };
  img.onerror = () => {
    console.warn(`Не удалось загрузить: ${shape.file}`);
  };
  loadedImages[index] = img;
});

// Параметры поля
const COLS = 10;
const ROWS = 20;

class TetrisGame {
  constructor() {
    this.canvas = document.getElementById('tetris-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.nextCanvas = document.getElementById('next-canvas');
    this.nextCtx = this.nextCanvas.getContext('2d');

    // UI элементы
    this.scoreEl = document.getElementById('score-val');
    this.highScoreEl = document.getElementById('highscore-val');
    this.levelEl = document.getElementById('level-val');
    this.linesEl = document.getElementById('lines-val');
    this.nextNameEl = document.getElementById('next-name');
    this.deviceTitleEl = document.getElementById('device-title');
    this.overlay = document.getElementById('game-overlay');
    this.overlayTitle = document.getElementById('overlay-title');
    this.finalScoreEl = document.getElementById('final-score');
    this.restartBtn = document.getElementById('restart-btn');
    this.soundBtn = document.getElementById('sound-btn');
    this.pauseBtn = document.getElementById('pause-btn');

    this.highScore = parseInt(localStorage.getItem('enip_tetris_highscore') || '0', 10);
    this.highScoreEl.textContent = this.highScore;

    this.cellSize = 26;
    this.initCanvasSize();

    this.grid = [];
    this.currentPiece = null;
    this.nextPiece = null;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.isPaused = false;
    this.isGameOver = false;

    this.dropCounter = 0;
    this.lastTime = 0;
    this.dropInterval = 800;

    this.bag = [];

    this.initGrid();
    this.bindEvents();
    this.reset();
  }

  initCanvasSize() {
    // Динамический расчёт размера ячейки под экран устройства
    const availableHeight = window.innerHeight - 220; // запас под шапку и кнопки
    const availableWidth = window.innerWidth - 150;  // запас под сайдбар

    const cellByH = Math.floor(availableHeight / ROWS);
    const cellByW = Math.floor(availableWidth / COLS);
    this.cellSize = Math.max(18, Math.min(32, cellByH, cellByW));

    this.canvas.width = COLS * this.cellSize;
    this.canvas.height = ROWS * this.cellSize;

    this.nextCanvas.width = 90;
    this.nextCanvas.height = 90;
  }

  initGrid() {
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  getNextFromBag() {
    if (this.bag.length === 0) {
      this.bag = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
    }
    const shapeIdx = this.bag.pop();
    const shape = SHAPES[shapeIdx];
    return {
      shapeIdx: shapeIdx,
      type: shape.type,
      name: shape.name,
      matrix: shape.matrix.map(row => [...row]),
      x: Math.floor((COLS - shape.matrix[0].length) / 2),
      y: 0
    };
  }

  reset() {
    this.initGrid();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropInterval = 800;
    this.isPaused = false;
    this.isGameOver = false;
    this.bag = [];

    this.currentPiece = this.getNextFromBag();
    this.nextPiece = this.getNextFromBag();

    this.updateUI();
    this.overlay.classList.add('hidden');
    this.pauseBtn.textContent = '⏸️';

    this.lastTime = performance.now();
    this.draw();
  }

  updateUI() {
    this.scoreEl.textContent = this.score;
    this.linesEl.textContent = this.lines;
    this.levelEl.textContent = this.level;
    this.nextNameEl.textContent = this.nextPiece.name;
    this.deviceTitleEl.textContent = `${this.currentPiece.name} (${this.currentPiece.type})`;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.highScoreEl.textContent = this.highScore;
      localStorage.setItem('enip_tetris_highscore', this.highScore.toString());
    }
  }

  collide(piece, offset = { x: 0, y: 0 }) {
    const { matrix, x, y } = piece;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const newX = x + c + offset.x;
          const newY = y + r + offset.y;

          if (newX < 0 || newX >= COLS || newY >= ROWS) {
            return true;
          }
          if (newY >= 0 && this.grid[newY][newX] !== null) {
            return true;
          }
        }
      }
    }
    return false;
  }

  rotateMatrix(matrix) {
    const N = matrix.length;
    const result = Array.from({ length: N }, () => Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        result[c][N - 1 - r] = matrix[r][c];
      }
    }
    return result;
  }

  rotate() {
    if (this.isPaused || this.isGameOver) return;
    sound.init();

    const originalMatrix = this.currentPiece.matrix;
    const rotated = this.rotateMatrix(originalMatrix);
    const originalX = this.currentPiece.x;

    this.currentPiece.matrix = rotated;

    // Смещение от стен (Wall kick)
    const offsets = [0, 1, -1, 2, -2];
    let kicked = false;
    for (const offset of offsets) {
      if (!this.collide(this.currentPiece, { x: offset, y: 0 })) {
        this.currentPiece.x += offset;
        kicked = true;
        break;
      }
    }

    if (!kicked) {
      this.currentPiece.matrix = originalMatrix;
      this.currentPiece.x = originalX;
    } else {
      sound.rotate();
      triggerHaptic('light');
      this.draw();
    }
  }

  moveLeft() {
    if (this.isPaused || this.isGameOver) return;
    sound.init();
    if (!this.collide(this.currentPiece, { x: -1, y: 0 })) {
      this.currentPiece.x--;
      sound.move();
      triggerHaptic('light');
      this.draw();
    }
  }

  moveRight() {
    if (this.isPaused || this.isGameOver) return;
    sound.init();
    if (!this.collide(this.currentPiece, { x: 1, y: 0 })) {
      this.currentPiece.x++;
      sound.move();
      triggerHaptic('light');
      this.draw();
    }
  }

  softDrop() {
    if (this.isPaused || this.isGameOver) return;
    sound.init();
    if (!this.collide(this.currentPiece, { x: 0, y: 1 })) {
      this.currentPiece.y++;
      this.score += 1;
      this.updateUI();
      sound.move();
      this.draw();
    } else {
      this.lockPiece();
    }
  }

  hardDrop() {
    if (this.isPaused || this.isGameOver) return;
    sound.init();
    let dropDist = 0;
    while (!this.collide(this.currentPiece, { x: 0, y: 1 })) {
      this.currentPiece.y++;
      dropDist++;
    }
    this.score += dropDist * 2;
    this.updateUI();
    sound.drop();
    triggerHaptic('medium');
    this.lockPiece();
    this.draw();
  }

  getGhostY() {
    let ghostY = this.currentPiece.y;
    while (!this.collide(this.currentPiece, { x: 0, y: ghostY - this.currentPiece.y + 1 })) {
      ghostY++;
    }
    return ghostY;
  }

  lockPiece() {
    const { matrix, x, y, shapeIdx } = this.currentPiece;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const boardY = y + r;
          const boardX = x + c;
          if (boardY < 0) {
            this.triggerGameOver();
            return;
          }
          this.grid[boardY][boardX] = shapeIdx;
        }
      }
    }

    this.clearLines();

    this.currentPiece = this.nextPiece;
    this.nextPiece = this.getNextFromBag();

    if (this.collide(this.currentPiece)) {
      this.triggerGameOver();
    } else {
      this.updateUI();
    }
  }

  clearLines() {
    let linesCleared = 0;

    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.grid[r].every(cell => cell !== null)) {
        this.grid.splice(r, 1);
        this.grid.unshift(Array(COLS).fill(null));
        linesCleared++;
        r++; // перепроверить текущую строчку после сдвига
      }
    }

    if (linesCleared > 0) {
      this.lines += linesCleared;
      const points = [0, 100, 300, 500, 800][linesCleared] || (linesCleared * 200);
      this.score += points * this.level;

      // Повышение уровня каждые 10 линий
      const newLevel = Math.floor(this.lines / 10) + 1;
      if (newLevel !== this.level) {
        this.level = newLevel;
        this.dropInterval = Math.max(120, 800 - (this.level - 1) * 65);
      }

      sound.clearLine(linesCleared);
      triggerHaptic('success');
      this.updateUI();
    }
  }

  triggerGameOver() {
    this.isGameOver = true;
    sound.gameOver();
    triggerHaptic('error');

    this.overlayTitle.textContent = 'ИГРА ОКОНЧЕНА';
    this.finalScoreEl.textContent = this.score;
    this.overlay.classList.remove('hidden');
  }

  togglePause() {
    if (this.isGameOver) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.pauseBtn.textContent = '▶️';
      this.overlayTitle.textContent = 'ПАУЗА';
      this.finalScoreEl.textContent = this.score;
      this.overlay.classList.remove('hidden');
    } else {
      this.pauseBtn.textContent = '⏸️';
      this.overlay.classList.add('hidden');
      this.lastTime = performance.now();
    }
  }

  drawCell(ctx, shapeIdx, px, py, size, alpha = 1.0) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const img = loadedImages[shapeIdx];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, px, py, size, size);
      // Тонкая рамка для четкого визуального разделения блоков
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    } else {
      // Фолбэк цвет
      const colors = ['#00f0f0', '#f0f000', '#a000f0', '#00f000', '#f00000', '#0000f0', '#f0a000'];
      ctx.fillStyle = colors[shapeIdx] || '#888';
      ctx.fillRect(px, py, size, size);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(px, py, size, size);
    }
    ctx.restore();
  }

  draw() {
    const ctx = this.ctx;
    const S = this.cellSize;

    // Фон стакана
    ctx.fillStyle = '#090e15';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Сетка стакана
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * S, 0);
      ctx.lineTo(c * S, ROWS * S);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * S);
      ctx.lineTo(COLS * S, r * S);
      ctx.stroke();
    }

    // Зафиксированные блоки на поле
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const shapeIdx = this.grid[r][c];
        if (shapeIdx !== null) {
          this.drawCell(ctx, shapeIdx, c * S, r * S, S);
        }
      }
    }

    // Отрисовка активной фигуры и проекции (Ghost piece)
    if (this.currentPiece && !this.isGameOver) {
      const ghostY = this.getGhostY();
      const { matrix, x, y, shapeIdx } = this.currentPiece;

      // Тень / призрак
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] !== 0) {
            this.drawCell(ctx, shapeIdx, (x + c) * S, (ghostY + r) * S, S, 0.25);
          }
        }
      }

      // Сама падающая фигура
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] !== 0) {
            this.drawCell(ctx, shapeIdx, (x + c) * S, (y + r) * S, S, 1.0);
          }
        }
      }
    }

    // Отрисовка следующей фигуры
    this.drawNextPiece();
  }

  drawNextPiece() {
    const ctx = this.nextCtx;
    ctx.fillStyle = '#090e15';
    ctx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);

    if (!this.nextPiece) return;

    const { matrix, shapeIdx } = this.nextPiece;
    const miniSize = 20;
    const pieceW = matrix[0].length * miniSize;
    const pieceH = matrix.length * miniSize;
    const startX = Math.floor((this.nextCanvas.width - pieceW) / 2);
    const startY = Math.floor((this.nextCanvas.height - pieceH) / 2);

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          this.drawCell(ctx, shapeIdx, startX + c * miniSize, startY + r * miniSize, miniSize);
        }
      }
    }
  }

  update(time = 0) {
    const deltaTime = time - this.lastTime;
    this.lastTime = time;

    if (!this.isPaused && !this.isGameOver) {
      this.dropCounter += deltaTime;
      if (this.dropCounter > this.dropInterval) {
        if (!this.collide(this.currentPiece, { x: 0, y: 1 })) {
          this.currentPiece.y++;
        } else {
          this.lockPiece();
        }
        this.dropCounter = 0;
        this.draw();
      }
    }

    requestAnimationFrame(this.update.bind(this));
  }

  bindEvents() {
    // Клавиатура (ПК / Telegram Desktop)
    window.addEventListener('keydown', (e) => {
      sound.init();
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.moveLeft();
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.moveRight();
          e.preventDefault();
          break;
        case 'ArrowUp':
        case 'KeyW':
          this.rotate();
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.softDrop();
          e.preventDefault();
          break;
        case 'Space':
          this.hardDrop();
          e.preventDefault();
          break;
        case 'KeyP':
        case 'Escape':
          this.togglePause();
          e.preventDefault();
          break;
        case 'KeyR':
          this.reset();
          e.preventDefault();
          break;
      }
    });

    // Экранные кнопки управления (Мобильные / Сенсор)
    const setupTouchBtn = (id, action, repeat = false) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      let interval = null;
      let timeout = null;

      const trigger = (e) => {
        if (e) e.preventDefault();
        sound.init();
        action();
      };

      btn.addEventListener('pointerdown', (e) => {
        trigger(e);
        if (repeat) {
          timeout = setTimeout(() => {
            interval = setInterval(trigger, 80);
          }, 220);
        }
      });

      const clear = () => {
        if (timeout) clearTimeout(timeout);
        if (interval) clearInterval(interval);
      };

      btn.addEventListener('pointerup', clear);
      btn.addEventListener('pointercancel', clear);
      btn.addEventListener('pointerleave', clear);
    };

    setupTouchBtn('ctrl-left', () => this.moveLeft(), true);
    setupTouchBtn('ctrl-right', () => this.moveRight(), true);
    setupTouchBtn('ctrl-down', () => this.softDrop(), true);
    setupTouchBtn('ctrl-rotate', () => this.rotate(), false);
    setupTouchBtn('ctrl-drop', () => this.hardDrop(), false);

    // Пауза и перезапуск
    this.pauseBtn.addEventListener('click', () => this.togglePause());
    this.restartBtn.addEventListener('click', () => this.reset());

    // Переключатель звука
    this.soundBtn.addEventListener('click', () => {
      sound.enabled = !sound.enabled;
      this.soundBtn.textContent = sound.enabled ? '🔊' : '🔇';
    });

    // Пересчёт размеров при смене ориентации экрана
    window.addEventListener('resize', () => {
      this.initCanvasSize();
      this.draw();
    });
  }
}

// Запуск игры
let game;
window.addEventListener('DOMContentLoaded', () => {
  game = new TetrisGame();
  requestAnimationFrame(game.update.bind(game));
});
