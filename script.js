const WORD_DATA = {
  Countries: [
    'Canada', 'Brazil', 'Japan', 'Nigeria', 'France', 'India', 'Mexico', 'Italy', 'Sweden', 'Turkey', 'Spain', 'Germany'
  ],
  Science: [
    'Atom', 'Gravity', 'Energy', 'Planet', 'Neuron', 'Molecule', 'Ecosystem', 'Oxygen', 'Photosynthesis', 'Magnet'
  ],
  'School Subjects': [
    'Mathematics', 'History', 'Geography', 'Physics', 'Biology', 'Chemistry', 'English', 'Economics', 'Art', 'Music'
  ],
  'General Knowledge': [
    'Library', 'Compass', 'Internet', 'Puzzle', 'Culture', 'Knowledge', 'Calendar', 'Language', 'Festival', 'Museum'
  ]
};

const DIFFICULTY = {
  easy: { size: 10, words: 6, seconds: 420 },
  medium: { size: 12, words: 8, seconds: 360 },
  hard: { size: 14, words: 10, seconds: 300 }
};

const DIRECTIONS = [
  { dr: 0, dc: 1 },  // horizontal
  { dr: 1, dc: 0 },  // vertical
  { dr: 1, dc: 1 },  // diagonal down-right
  { dr: -1, dc: 1 }  // diagonal up-right
];

const els = {
  grid: document.getElementById('grid'),
  wordList: document.getElementById('wordList'),
  feedback: document.getElementById('feedback'),
  foundCount: document.getElementById('foundCount'),
  totalWords: document.getElementById('totalWords'),
  timerValue: document.getElementById('timerValue'),
  scoreValue: document.getElementById('scoreValue'),
  difficultySelect: document.getElementById('difficultySelect'),
  categorySelect: document.getElementById('categorySelect'),
  newGameBtn: document.getElementById('newGameBtn'),
  restartBtn: document.getElementById('restartBtn'),
  fullscreenBtn: document.getElementById('fullscreenBtn'),
  overlay: document.getElementById('gameOverOverlay'),
  gameOverMessage: document.getElementById('gameOverMessage'),
  playAgainBtn: document.getElementById('playAgainBtn')
};

const optionalSounds = {
  correct: new Audio('assets/sounds/correct.mp3'),
  wrong: new Audio('assets/sounds/wrong.mp3'),
  click: new Audio('assets/sounds/click.mp3')
};

Object.values(optionalSounds).forEach((a) => {
  a.preload = 'auto';
  a.addEventListener('error', () => { a.datasetUnavailable = 'true'; });
});

function playSound(type) {
  const audio = optionalSounds[type];
  if (!audio || audio.datasetUnavailable === 'true') return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

let state = {
  difficulty: 'medium',
  category: 'all',
  size: 12,
  matrix: [],
  placedWords: [],
  foundWords: new Set(),
  score: 0,
  timeLeft: 0,
  timerId: null,
  selectionPath: [],
  isDragging: false
};

function sanitizeWord(word) {
  return word.toUpperCase().replace(/[^A-Z]/g, '');
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getWordPool(category) {
  if (category === 'all') {
    return Object.values(WORD_DATA).flat();
  }
  return WORD_DATA[category] || [];
}

function pickWords() {
  const cfg = DIFFICULTY[state.difficulty];
  const pool = getWordPool(state.category)
    .map((value) => ({ label: value, token: sanitizeWord(value) }))
    .filter((entry) => entry.token.length > 2 && entry.token.length <= cfg.size);

  return shuffle(pool).slice(0, cfg.words);
}

function buildEmptyGrid(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => ''));
}

function canPlaceWord(grid, word, row, col, dr, dc) {
  for (let i = 0; i < word.length; i += 1) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (r < 0 || c < 0 || r >= state.size || c >= state.size) return false;
    if (grid[r][c] && grid[r][c] !== word[i]) return false;
  }
  return true;
}

function placeWord(grid, entry) {
  const attempts = 160;
  for (let i = 0; i < attempts; i += 1) {
    const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    const row = Math.floor(Math.random() * state.size);
    const col = Math.floor(Math.random() * state.size);

    if (!canPlaceWord(grid, entry.token, row, col, direction.dr, direction.dc)) continue;

    const cells = [];
    for (let j = 0; j < entry.token.length; j += 1) {
      const r = row + direction.dr * j;
      const c = col + direction.dc * j;
      grid[r][c] = entry.token[j];
      cells.push(`${r}-${c}`);
    }

    return { ...entry, cells };
  }
  return null;
}

function generateGame() {
  const cfg = DIFFICULTY[state.difficulty];
  state.size = cfg.size;
  const matrix = buildEmptyGrid(cfg.size);
  const picked = pickWords();
  const placed = [];

  picked.forEach((entry) => {
    const result = placeWord(matrix, entry);
    if (result) placed.push(result);
  });

  for (let r = 0; r < cfg.size; r += 1) {
    for (let c = 0; c < cfg.size; c += 1) {
      if (!matrix[r][c]) {
        matrix[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      }
    }
  }

  state.matrix = matrix;
  state.placedWords = placed;
  state.foundWords = new Set();
  state.score = 0;
  state.timeLeft = cfg.seconds;
}

function renderWords() {
  els.wordList.innerHTML = '';
  state.placedWords.forEach((entry) => {
    const li = document.createElement('li');
    li.dataset.word = entry.token;
    li.textContent = entry.label;
    if (state.foundWords.has(entry.token)) li.classList.add('found');
    els.wordList.appendChild(li);
  });

  els.foundCount.textContent = String(state.foundWords.size);
  els.totalWords.textContent = String(state.placedWords.length);
  els.scoreValue.textContent = String(state.score);
}

function renderGrid() {
  els.grid.style.setProperty('--size', String(state.size));
  els.grid.innerHTML = '';

  for (let r = 0; r < state.size; r += 1) {
    for (let c = 0; c < state.size; c += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell';
      btn.dataset.row = String(r);
      btn.dataset.col = String(c);
      btn.dataset.key = `${r}-${c}`;
      btn.textContent = state.matrix[r][c];
      els.grid.appendChild(btn);
    }
  }

  markFoundCells();
}

function markFoundCells() {
  const foundCells = new Set();
  state.placedWords.forEach((word) => {
    if (state.foundWords.has(word.token)) {
      word.cells.forEach((key) => foundCells.add(key));
    }
  });

  els.grid.querySelectorAll('.cell').forEach((cell) => {
    if (foundCells.has(cell.dataset.key)) {
      cell.classList.add('found');
    }
  });
}

function clearSelectionVisuals() {
  els.grid.querySelectorAll('.cell.selected').forEach((el) => el.classList.remove('selected'));
}

function getCellFromPoint(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  if (!element || !element.classList.contains('cell')) return null;
  return element;
}

function uniquePath(path) {
  const out = [];
  const seen = new Set();
  path.forEach((item) => {
    if (!seen.has(item.key)) {
      seen.add(item.key);
      out.push(item);
    }
  });
  return out;
}

function isStraightLine(path) {
  if (path.length < 2) return true;
  const dr = path[1].row - path[0].row;
  const dc = path[1].col - path[0].col;
  if (!DIRECTIONS.some((d) => d.dr === dr && d.dc === dc || d.dr === -dr && d.dc === -dc)) return false;

  for (let i = 2; i < path.length; i += 1) {
    if (path[i].row - path[i - 1].row !== dr || path[i].col - path[i - 1].col !== dc) return false;
  }
  return true;
}

function lettersFromPath(path) {
  return path.map((p) => state.matrix[p.row][p.col]).join('');
}

function handleSelectionComplete() {
  if (state.selectionPath.length < 2) {
    clearSelectionVisuals();
    state.selectionPath = [];
    return;
  }

  const path = uniquePath(state.selectionPath);
  if (!isStraightLine(path)) {
    els.feedback.textContent = 'Selection must be horizontal, vertical, or diagonal.';
    els.feedback.className = 'feedback error';
    playSound('wrong');
    clearSelectionVisuals();
    state.selectionPath = [];
    return;
  }

  const forward = lettersFromPath(path);
  const backward = forward.split('').reverse().join('');

  const matched = state.placedWords.find((entry) => {
    return (entry.token === forward || entry.token === backward) && !state.foundWords.has(entry.token);
  });

  if (matched) {
    state.foundWords.add(matched.token);
    state.score += matched.token.length * 10;
    els.feedback.textContent = `✅ Great! You found "${matched.label}".`;
    els.feedback.className = 'feedback success';
    playSound('correct');
  } else {
    els.feedback.textContent = 'Not a target word. Try another path.';
    els.feedback.className = 'feedback error';
    playSound('wrong');
  }

  clearSelectionVisuals();
  state.selectionPath = [];
  renderWords();
  renderGrid();
  checkGameOver();
}

function addCellToPath(cell) {
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  const key = cell.dataset.key;
  state.selectionPath.push({ row, col, key });
  clearSelectionVisuals();
  uniquePath(state.selectionPath).forEach((p) => {
    const selectedCell = els.grid.querySelector(`.cell[data-key="${p.key}"]`);
    selectedCell?.classList.add('selected');
  });
}

function bindGridInteractions() {
  const startDrag = (event) => {
    const touch = event.touches?.[0];
    const target = event.target.classList?.contains('cell')
      ? event.target
      : getCellFromPoint(touch?.clientX ?? event.clientX, touch?.clientY ?? event.clientY);
    if (!target) return;

    state.isDragging = true;
    state.selectionPath = [];
    addCellToPath(target);
    playSound('click');
    event.preventDefault();
  };

  const moveDrag = (event) => {
    if (!state.isDragging) return;
    const touch = event.touches?.[0];
    const target = getCellFromPoint(touch?.clientX ?? event.clientX, touch?.clientY ?? event.clientY);
    if (!target) return;
    addCellToPath(target);
    event.preventDefault();
  };

  const endDrag = () => {
    if (!state.isDragging) return;
    state.isDragging = false;
    handleSelectionComplete();
  };

  els.grid.addEventListener('mousedown', startDrag);
  window.addEventListener('mousemove', moveDrag);
  window.addEventListener('mouseup', endDrag);

  els.grid.addEventListener('touchstart', startDrag, { passive: false });
  window.addEventListener('touchmove', moveDrag, { passive: false });
  window.addEventListener('touchend', endDrag);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function startTimer() {
  clearInterval(state.timerId);
  els.timerValue.textContent = formatTime(state.timeLeft);

  state.timerId = setInterval(() => {
    state.timeLeft -= 1;
    els.timerValue.textContent = formatTime(Math.max(0, state.timeLeft));

    if (state.timeLeft <= 0) {
      clearInterval(state.timerId);
      els.feedback.textContent = '⏰ Time is up!';
      els.feedback.className = 'feedback error';
      checkGameOver(true);
    }
  }, 1000);
}

function checkGameOver(outOfTime = false) {
  if (state.foundWords.size !== state.placedWords.length && !outOfTime) return;

  clearInterval(state.timerId);
  const total = state.placedWords.length;
  const found = state.foundWords.size;

  if (outOfTime) {
    els.gameOverMessage.textContent = `You found ${found} out of ${total} words. Score: ${state.score}.`;
  } else {
    const bonus = Math.max(state.timeLeft * 2, 0);
    state.score += bonus;
    els.scoreValue.textContent = String(state.score);
    els.gameOverMessage.textContent = `You found all ${total} words! Time bonus: +${bonus}. Final score: ${state.score}.`;
  }

  els.overlay.classList.add('show');
  els.overlay.setAttribute('aria-hidden', 'false');
}

function closeOverlay() {
  els.overlay.classList.remove('show');
  els.overlay.setAttribute('aria-hidden', 'true');
}

function startGame() {
  closeOverlay();
  state.difficulty = els.difficultySelect.value;
  state.category = els.categorySelect.value;
  generateGame();
  renderWords();
  renderGrid();
  els.feedback.textContent = 'Select letters by dragging across the grid.';
  els.feedback.className = 'feedback';
  startTimer();
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.getElementById('app').requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (_error) {
    // Silently ignore unsupported contexts.
  }
}

function setupLogoFallback() {
  document.querySelectorAll('[data-logo-wrap]').forEach((wrap) => {
    const img = wrap.querySelector('[data-logo]');
    if (!img) return;
    const fallback = () => wrap.classList.add('logo-missing');
    img.addEventListener('error', fallback, { once: true });
    if (img.complete && img.naturalWidth === 0) fallback();
  });
}

els.newGameBtn.addEventListener('click', startGame);
els.restartBtn.addEventListener('click', startGame);
els.playAgainBtn.addEventListener('click', startGame);
els.fullscreenBtn.addEventListener('click', toggleFullscreen);

setupLogoFallback();
bindGridInteractions();
startGame();
