const SIZE = 4;
const TARGET = 2048;

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('bestScore');
const overlayEl = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMessage = document.getElementById('overlayMessage');
const continueBtn = document.getElementById('continueBtn');
const restartBtn = document.getElementById('restartBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');

let tiles = [];
let score = 0;
let bestScore = Number(localStorage.getItem('oxbridge-2048-best') || 0);
let won = false;
let keepPlaying = false;
let touchStart = null;
let moveLocked = false;

const sounds = {
  move: new Audio('assets/sounds/move.mp3'),
  merge: new Audio('assets/sounds/merge.mp3'),
  click: new Audio('assets/sounds/click.mp3'),
  win: new Audio('assets/sounds/win.mp3'),
  end: new Audio('assets/sounds/end.mp3')
};

Object.values(sounds).forEach((audio) => {
  audio.preload = 'auto';
  audio.addEventListener('error', () => {
    audio.datasetUnavailable = 'true';
  });
});

function playSound(name) {
  const sound = sounds[name];
  if (!sound || sound.datasetUnavailable === 'true') return;
  try {
    sound.currentTime = 0;
    sound.play().catch(() => {});
  } catch (_error) {
    // Graceful fail for unsupported or blocked playback.
  }
}

function setupLogoFallbacks() {
  document.querySelectorAll('[data-logo-wrap]').forEach((wrap) => {
    const img = wrap.querySelector('[data-brand-logo]');
    if (!img) return;

    const showFallback = () => {
      wrap.classList.add('logo-missing');
    };

    img.addEventListener('error', showFallback, { once: true });
    if (img.complete && img.naturalWidth === 0) showFallback();
  });
}

function createBackgroundCells() {
  const fragment = document.createDocumentFragment();
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      const { top, left } = positionFor(r, c);
      cell.style.top = top;
      cell.style.left = left;
      fragment.appendChild(cell);
    }
  }
  boardEl.innerHTML = '';
  boardEl.appendChild(fragment);
}

function positionFor(row, col) {
  return {
    top: `calc(var(--gap) + ${row} * (var(--cell) + var(--gap)))`,
    left: `calc(var(--gap) + ${col} * (var(--cell) + var(--gap)))`
  };
}

function newTile(row, col, value = Math.random() < 0.9 ? 2 : 4, isNew = true) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    row,
    col,
    value,
    isNew,
    merged: false
  };
}

function emptyCells() {
  const filled = new Set(tiles.map((t) => `${t.row},${t.col}`));
  const empties = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (!filled.has(`${r},${c}`)) empties.push({ row: r, col: c });
    }
  }
  return empties;
}

function spawnRandomTile() {
  const empties = emptyCells();
  if (!empties.length) return;
  const pick = empties[Math.floor(Math.random() * empties.length)];
  tiles.push(newTile(pick.row, pick.col));
}

function resetGame() {
  tiles = [];
  score = 0;
  won = false;
  keepPlaying = false;
  overlayEl.classList.add('hidden');
  continueBtn.classList.add('hidden');
  spawnRandomTile();
  spawnRandomTile();
  updateScore();
  render();
}

function updateScore() {
  scoreEl.textContent = String(score);
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('oxbridge-2048-best', String(bestScore));
  }
  bestScoreEl.textContent = String(bestScore);
}

function lineTiles(index, horizontal, reversed) {
  const line = [];
  for (let i = 0; i < SIZE; i += 1) {
    const row = horizontal ? index : i;
    const col = horizontal ? i : index;
    const tile = tiles.find((t) => t.row === row && t.col === col);
    if (tile) line.push(tile);
  }
  line.sort((a, b) => {
    const aa = horizontal ? a.col : a.row;
    const bb = horizontal ? b.col : b.row;
    return reversed ? bb - aa : aa - bb;
  });
  return line;
}

function move(direction) {
  if (moveLocked || (won && !keepPlaying) || !overlayEl.classList.contains('hidden')) return;

  moveLocked = true;
  tiles.forEach((t) => {
    t.isNew = false;
    t.merged = false;
  });

  const horizontal = direction === 'left' || direction === 'right';
  const reversed = direction === 'right' || direction === 'down';
  let moved = false;
  let mergedAny = false;

  for (let index = 0; index < SIZE; index += 1) {
    const line = lineTiles(index, horizontal, reversed);
    let target = reversed ? SIZE - 1 : 0;
    let previous = null;

    line.forEach((tile) => {
      const currentPos = horizontal ? tile.col : tile.row;
      const destRow = horizontal ? index : target;
      const destCol = horizontal ? target : index;

      if (previous && previous.value === tile.value) {
        score += tile.value * 2;
        previous.value *= 2;
        previous.merged = true;

        if (horizontal) {
          tile.col = previous.col;
        } else {
          tile.row = previous.row;
        }

        moved ||= currentPos !== target + (reversed ? 1 : -1);
        mergedAny = true;
        tiles = tiles.filter((t) => t.id !== tile.id);
        previous = null;
      } else {
        if (horizontal) {
          moved ||= tile.col !== destCol;
          tile.col = destCol;
          tile.row = destRow;
        } else {
          moved ||= tile.row !== destRow;
          tile.row = destRow;
          tile.col = destCol;
        }
        previous = tile;
        target += reversed ? -1 : 1;
      }
    });
  }

  if (moved || mergedAny) {
    spawnRandomTile();
    updateScore();
    render();
    playSound(mergedAny ? 'merge' : 'move');
    if (!won && tiles.some((t) => t.value >= TARGET)) {
      won = true;
      showOverlay('You Win! 🎉', 'You reached 2048. Continue playing or start again.', true);
      playSound('win');
    } else if (!movesAvailable()) {
      showOverlay('Game Over', 'No more valid moves. Try again to beat your best score.', false);
      playSound('end');
    }
  }

  setTimeout(() => {
    moveLocked = false;
  }, 160);
}

function movesAvailable() {
  if (tiles.length < SIZE * SIZE) return true;

  for (const tile of tiles) {
    const neighbors = [
      [tile.row - 1, tile.col],
      [tile.row + 1, tile.col],
      [tile.row, tile.col - 1],
      [tile.row, tile.col + 1]
    ];
    for (const [r, c] of neighbors) {
      const other = tiles.find((t) => t.row === r && t.col === c);
      if (other && other.value === tile.value) return true;
    }
  }
  return false;
}

function render() {
  boardEl.querySelectorAll('.tile').forEach((el) => el.remove());
  const fragment = document.createDocumentFragment();

  tiles.forEach((tile) => {
    const el = document.createElement('div');
    el.className = 'tile';
    if (tile.isNew) el.classList.add('new');
    if (tile.merged) el.classList.add('merged');
    el.dataset.val = String(tile.value);
    el.textContent = String(tile.value);

    const { top, left } = positionFor(tile.row, tile.col);
    el.style.top = top;
    el.style.left = left;

    if (tile.value >= 1024) {
      el.style.fontSize = 'clamp(1.05rem, 4vw, 1.65rem)';
    } else if (tile.value >= 128) {
      el.style.fontSize = 'clamp(1.15rem, 4.6vw, 1.85rem)';
    } else {
      el.style.fontSize = 'clamp(1.35rem, 5vw, 2.1rem)';
    }

    fragment.appendChild(el);
  });

  boardEl.appendChild(fragment);
}

function showOverlay(title, message, withContinue) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlayEl.classList.remove('hidden');
  continueBtn.classList.toggle('hidden', !withContinue);
}

function hideOverlay() {
  overlayEl.classList.add('hidden');
}

function handleKey(event) {
  const map = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down'
  };
  const dir = map[event.key];
  if (!dir) return;
  event.preventDefault();
  move(dir);
}

function handleTouchStart(event) {
  if (!event.touches?.length) return;
  const touch = event.touches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}

function handleTouchEnd(event) {
  if (!touchStart || !event.changedTouches?.length) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const threshold = 24;

  if (Math.max(absX, absY) < threshold) {
    touchStart = null;
    return;
  }

  if (absX > absY) {
    move(dx > 0 ? 'right' : 'left');
  } else {
    move(dy > 0 ? 'down' : 'up');
  }

  touchStart = null;
}

async function toggleFullscreen() {
  try {
    const element = document.documentElement;
    if (!document.fullscreenElement) {
      await element.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (_error) {
    // Fullscreen may be blocked in embedded or mobile contexts.
  }
}

function attachEvents() {
  document.addEventListener('keydown', handleKey);
  boardEl.addEventListener('touchstart', handleTouchStart, { passive: true });
  boardEl.addEventListener('touchend', handleTouchEnd, { passive: true });

  restartBtn.addEventListener('click', () => {
    playSound('click');
    hideOverlay();
    resetGame();
  });

  playAgainBtn.addEventListener('click', () => {
    playSound('click');
    hideOverlay();
    resetGame();
  });

  continueBtn.addEventListener('click', () => {
    playSound('click');
    keepPlaying = true;
    hideOverlay();
  });

  fullscreenBtn.addEventListener('click', () => {
    playSound('click');
    toggleFullscreen();
  });
}

function init() {
  setupLogoFallbacks();
  createBackgroundCells();
  attachEvents();
  bestScoreEl.textContent = String(bestScore);
  resetGame();
}

init();
