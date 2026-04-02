const difficulties = {
  easy: { cols: 4, pairs: 8 },
  medium: { cols: 5, pairs: 10 },
  hard: { cols: 6, pairs: 12 }
};

const symbols = [
  { icon: '📚', label: 'Books' },
  { icon: '🔬', label: 'Science' },
  { icon: '🌍', label: 'Globe' },
  { icon: '✏️', label: 'Pencil' },
  { icon: '🏆', label: 'Trophy' },
  { icon: '🎵', label: 'Music note' },
  { icon: '🧮', label: 'Calculator' },
  { icon: '⚗️', label: 'Lab flask' },
  { icon: '📐', label: 'Geometry set' },
  { icon: '📝', label: 'Notebook' },
  { icon: '🌟', label: 'Achievement star' },
  { icon: '🧠', label: 'Brain' }
];

const board = document.getElementById('board');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const soundBtn = document.getElementById('soundBtn');
const difficultySelect = document.getElementById('difficultySelect');
const movesCount = document.getElementById('movesCount');
const matchedCount = document.getElementById('matchedCount');
const totalPairsCount = document.getElementById('totalPairsCount');
const timeCount = document.getElementById('timeCount');
const endScreen = document.getElementById('endScreen');
const endSummary = document.getElementById('endSummary');
const gameApp = document.getElementById('gameApp');
const schoolLogo = document.getElementById('schoolLogo');
const logoFallback = document.getElementById('logoFallback');

let gameStarted = false;
let canFlip = true;
let firstCard = null;
let secondCard = null;
let moves = 0;
let matchedPairs = 0;
let totalPairs = difficulties.easy.pairs;
let timerId = null;
let startTime = null;
let soundEnabled = true;

function showLogoFallback() {
  schoolLogo.hidden = true;
  logoFallback.hidden = false;
}

schoolLogo.addEventListener('error', showLogoFallback, { once: true });
if (schoolLogo.complete && schoolLogo.naturalWidth === 0) {
  showLogoFallback();
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createDeck(pairCount) {
  const selected = shuffle(symbols).slice(0, pairCount);
  return shuffle([...selected, ...selected]).map((item, index) => ({
    ...item,
    uid: `${item.label}-${index}`
  }));
}

function formatTime(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function updateStats() {
  movesCount.textContent = String(moves);
  matchedCount.textContent = String(matchedPairs);
  totalPairsCount.textContent = String(totalPairs);
}

function startTimer() {
  clearInterval(timerId);
  startTime = Date.now();
  timeCount.textContent = '00:00';

  timerId = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    timeCount.textContent = formatTime(elapsed);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
}

function playTone(type) {
  if (!soundEnabled) return;

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  const tones = {
    click: [540, 0.06],
    flip: [420, 0.08],
    match: [760, 0.15],
    mismatch: [210, 0.2],
    success: [960, 0.35]
  };

  const [freq, duration] = tones[type] || tones.click;
  oscillator.frequency.setValueAtTime(freq, now);
  gainNode.gain.setValueAtTime(0.001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.17, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.01);

  oscillator.onended = () => {
    audioCtx.close();
  };
}

function lockBoardTemporarily(delay = 750) {
  canFlip = false;
  setTimeout(() => {
    canFlip = true;
  }, delay);
}

function resetTurn() {
  firstCard = null;
  secondCard = null;
}

function finishGame() {
  gameStarted = false;
  canFlip = false;
  stopTimer();
  playTone('success');
  endSummary.textContent = `Completed in ${moves} moves and ${timeCount.textContent}.`;
  endScreen.hidden = false;
}

function checkPair() {
  if (!firstCard || !secondCard) return;

  const matched = firstCard.dataset.symbol === secondCard.dataset.symbol;

  if (matched) {
    firstCard.classList.add('is-matched');
    secondCard.classList.add('is-matched');
    firstCard.setAttribute('aria-disabled', 'true');
    secondCard.setAttribute('aria-disabled', 'true');
    matchedPairs += 1;
    updateStats();
    playTone('match');
    resetTurn();

    if (matchedPairs === totalPairs) {
      finishGame();
    }
    return;
  }

  playTone('mismatch');
  lockBoardTemporarily();
  setTimeout(() => {
    firstCard.classList.remove('is-open');
    secondCard.classList.remove('is-open');
    resetTurn();
  }, 720);
}

function flipCard(button) {
  if (!gameStarted || !canFlip) return;
  if (button.classList.contains('is-open') || button.classList.contains('is-matched')) return;

  playTone('flip');
  button.classList.add('is-open');

  if (!firstCard) {
    firstCard = button;
    return;
  }

  secondCard = button;
  moves += 1;
  updateStats();
  checkPair();
}

function createCard(item) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';
  card.dataset.symbol = item.label;
  card.setAttribute('role', 'gridcell');
  card.setAttribute('aria-label', `Memory card: ${item.label}`);

  const front = document.createElement('span');
  front.className = 'card-face card-front';
  front.textContent = 'OTC';

  const back = document.createElement('span');
  back.className = 'card-face card-back';
  back.textContent = item.icon;
  back.title = item.label;

  card.append(front, back);
  card.addEventListener('click', () => flipCard(card));

  return card;
}

function buildBoard() {
  const level = difficulties[difficultySelect.value] || difficulties.easy;
  totalPairs = level.pairs;

  const deck = createDeck(totalPairs);
  board.innerHTML = '';
  board.style.gridTemplateColumns = `repeat(${level.cols}, minmax(0, 1fr))`;

  deck.forEach((item) => {
    board.appendChild(createCard(item));
  });
}

function startGame() {
  gameStarted = true;
  canFlip = true;
  moves = 0;
  matchedPairs = 0;
  endScreen.hidden = true;
  resetTurn();
  buildBoard();
  updateStats();
  startTimer();
}

function restartGame() {
  playTone('click');
  startGame();
}

async function toggleFullscreen() {
  playTone('click');
  try {
    if (!document.fullscreenElement) {
      await gameApp.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (_error) {
    // Browser may block fullscreen in iframes without interaction/permission.
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  soundBtn.textContent = `Sound: ${soundEnabled ? 'On' : 'Off'}`;
  soundBtn.setAttribute('aria-pressed', String(soundEnabled));
  if (soundEnabled) playTone('click');
}

startBtn.addEventListener('click', () => {
  playTone('click');
  startGame();
});
restartBtn.addEventListener('click', restartGame);
playAgainBtn.addEventListener('click', restartGame);
fullscreenBtn.addEventListener('click', toggleFullscreen);
soundBtn.addEventListener('click', toggleSound);
difficultySelect.addEventListener('change', () => {
  if (gameStarted) {
    restartGame();
  }
});

updateStats();
buildBoard();
