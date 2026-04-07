const boardEl = document.getElementById('board');
const turnIndicatorEl = document.getElementById('turnIndicator');
const gameStatusEl = document.getElementById('gameStatus');
const undoBtn = document.getElementById('undoBtn');
const restartBtn = document.getElementById('restartBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const modeSelectEl = document.getElementById('modeSelect');
const difficultySelectEl = document.getElementById('difficultySelect');
const schoolLogoEl = document.getElementById('schoolLogo');

const PIECE_TEXT = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 200 };
const KNIGHT_OFFSETS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING_OFFSETS = [[1, 1], [1, 0], [1, -1], [0, 1], [0, -1], [-1, 1], [-1, 0], [-1, -1]];

// Future 3D asset hook placeholder: IDs and loader are intentionally stub-only for phase-3 readiness.
const pieceAssetMap = {
  'w-k': null, 'w-q': null, 'w-r': null, 'w-b': null, 'w-n': null, 'w-p': null,
  'b-k': null, 'b-q': null, 'b-r': null, 'b-b': null, 'b-n': null, 'b-p': null
};
function loadPieceAsset(pieceId) {
  return pieceAssetMap[pieceId] ?? null;
}
function renderPiece(piece) {
  const pieceId = `${piece.color}-${piece.type}`;
  const asset = loadPieceAsset(pieceId);
  if (asset) return asset;
  return PIECE_TEXT[piece.color][piece.type];
}

let game = null;
let selectedSquare = null;
let legalTargets = new Map();
let history = [];
let aiBusy = false;

function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function squareKey(r, c) { return `${r},${c}`; }
function parseSquare(key) { const [r, c] = key.split(',').map(Number); return { r, c }; }
function enemy(color) { return color === 'w' ? 'b' : 'w'; }

function makePiece(color, type) {
  return { color, type, moved: false };
}

function createInitialBoard() {
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c += 1) {
    board[0][c] = makePiece('b', back[c]);
    board[1][c] = makePiece('b', 'p');
    board[6][c] = makePiece('w', 'p');
    board[7][c] = makePiece('w', back[c]);
  }
  return board;
}

function cloneState(state) {
  return {
    board: state.board.map((row) => row.map((piece) => (piece ? { ...piece } : null))),
    turn: state.turn,
    enPassant: state.enPassant ? { ...state.enPassant } : null,
    over: state.over,
    winner: state.winner,
    status: state.status
  };
}

function createNewGame() {
  // Fresh board-state architecture: board + turn + metadata are the only source of truth.
  game = {
    board: createInitialBoard(),
    turn: 'w',
    enPassant: null,
    over: false,
    winner: null,
    status: 'Game in progress.'
  };
  selectedSquare = null;
  legalTargets = new Map();
  history = [];
  aiBusy = false;
  render();
}

function isSquareAttacked(state, r, c, byColor) {
  const board = state.board;
  const pawnDir = byColor === 'w' ? -1 : 1;
  for (const dc of [-1, 1]) {
    const pr = r - pawnDir;
    const pc = c + dc;
    if (inBounds(pr, pc)) {
      const p = board[pr][pc];
      if (p && p.color === byColor && p.type === 'p') return true;
    }
  }

  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p && p.color === byColor && p.type === 'n') return true;
    }
  }

  const sliders = [
    { dirs: [[1, 0], [-1, 0], [0, 1], [0, -1]], types: ['r', 'q'] },
    { dirs: [[1, 1], [1, -1], [-1, 1], [-1, -1]], types: ['b', 'q'] }
  ];

  for (const group of sliders) {
    for (const [dr, dc] of group.dirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p) {
          if (p.color === byColor && group.types.includes(p.type)) return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  for (const [dr, dc] of KING_OFFSETS) {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p && p.color === byColor && p.type === 'k') return true;
    }
  }

  return false;
}

function findKing(state, color) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = state.board[r][c];
      if (p && p.color === color && p.type === 'k') return { r, c };
    }
  }
  return null;
}

function inCheck(state, color) {
  const k = findKing(state, color);
  if (!k) return false;
  return isSquareAttacked(state, k.r, k.c, enemy(color));
}

function getPseudoMoves(state, r, c) {
  const board = state.board;
  const piece = board[r][c];
  if (!piece) return [];
  const moves = [];

  const push = (toR, toC, special = null) => {
    const target = board[toR][toC];
    moves.push({ from: { r, c }, to: { r: toR, c: toC }, capture: Boolean(target), special });
  };

  if (piece.type === 'p') {
    const dir = piece.color === 'w' ? -1 : 1;
    const startRank = piece.color === 'w' ? 6 : 1;
    const oneStep = r + dir;
    if (inBounds(oneStep, c) && !board[oneStep][c]) {
      push(oneStep, c);
      const twoStep = r + dir * 2;
      if (r === startRank && !board[twoStep][c]) push(twoStep, c, 'double-pawn');
    }
    for (const dc of [-1, 1]) {
      const tr = r + dir;
      const tc = c + dc;
      if (!inBounds(tr, tc)) continue;
      const target = board[tr][tc];
      if (target && target.color !== piece.color) push(tr, tc);
    }
    if (state.enPassant) {
      const { r: epR, c: epC } = state.enPassant;
      if (epR === r + dir && Math.abs(epC - c) === 1) {
        moves.push({ from: { r, c }, to: { r: epR, c: epC }, capture: true, special: 'en-passant' });
      }
    }
  }

  if (piece.type === 'n') {
    for (const [dr, dc] of KNIGHT_OFFSETS) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (!target || target.color !== piece.color) push(nr, nc);
    }
  }

  if (piece.type === 'b' || piece.type === 'r' || piece.type === 'q') {
    const dirs = [];
    if (piece.type !== 'b') dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    if (piece.type !== 'r') dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    for (const [dr, dc] of dirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = board[nr][nc];
        if (!target) {
          push(nr, nc);
        } else {
          if (target.color !== piece.color) push(nr, nc);
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  if (piece.type === 'k') {
    for (const [dr, dc] of KING_OFFSETS) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (!target || target.color !== piece.color) push(nr, nc);
    }

    if (!piece.moved && !inCheck(state, piece.color)) {
      const row = piece.color === 'w' ? 7 : 0;
      const rookKs = board[row][7];
      if (rookKs && rookKs.type === 'r' && rookKs.color === piece.color && !rookKs.moved) {
        if (!board[row][5] && !board[row][6] && !isSquareAttacked(state, row, 5, enemy(piece.color)) && !isSquareAttacked(state, row, 6, enemy(piece.color))) {
          moves.push({ from: { r, c }, to: { r: row, c: 6 }, capture: false, special: 'castle-kingside' });
        }
      }
      const rookQs = board[row][0];
      if (rookQs && rookQs.type === 'r' && rookQs.color === piece.color && !rookQs.moved) {
        if (!board[row][1] && !board[row][2] && !board[row][3] && !isSquareAttacked(state, row, 2, enemy(piece.color)) && !isSquareAttacked(state, row, 3, enemy(piece.color))) {
          moves.push({ from: { r, c }, to: { r: row, c: 2 }, capture: false, special: 'castle-queenside' });
        }
      }
    }
  }

  return moves;
}

function applyMove(state, move) {
  // Move execution layer: all board mutations occur in one place for deterministic updates.
  const next = cloneState(state);
  const board = next.board;
  const piece = board[move.from.r][move.from.c];
  board[move.from.r][move.from.c] = null;

  if (move.special === 'en-passant') {
    const captureRow = piece.color === 'w' ? move.to.r + 1 : move.to.r - 1;
    board[captureRow][move.to.c] = null;
  }

  if (move.special === 'castle-kingside') {
    board[move.to.r][5] = board[move.to.r][7];
    board[move.to.r][7] = null;
    if (board[move.to.r][5]) board[move.to.r][5].moved = true;
  }

  if (move.special === 'castle-queenside') {
    board[move.to.r][3] = board[move.to.r][0];
    board[move.to.r][0] = null;
    if (board[move.to.r][3]) board[move.to.r][3].moved = true;
  }

  board[move.to.r][move.to.c] = { ...piece, moved: true };

  if (piece.type === 'p' && (move.to.r === 0 || move.to.r === 7)) {
    board[move.to.r][move.to.c] = { color: piece.color, type: 'q', moved: true };
  }

  next.enPassant = null;
  if (move.special === 'double-pawn') {
    next.enPassant = { r: (move.from.r + move.to.r) / 2, c: move.from.c };
  }

  next.turn = enemy(state.turn);
  return next;
}

// Legal move generation: pseudo moves filtered through check safety.
function getLegalMovesForSquare(state, r, c) {
  const piece = state.board[r][c];
  if (!piece || piece.color !== state.turn) return [];
  const pseudo = getPseudoMoves(state, r, c);
  return pseudo.filter((move) => !inCheck(applyMove(state, move), piece.color));
}

function getAllLegalMoves(state, color = state.turn) {
  const all = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = state.board[r][c];
      if (!p || p.color !== color) continue;
      const moves = getLegalMovesForSquare({ ...state, turn: color }, r, c);
      all.push(...moves);
    }
  }
  return all;
}

function evaluateGameState() {
  const moves = getAllLegalMoves(game, game.turn);
  const sideInCheck = inCheck(game, game.turn);
  if (moves.length === 0) {
    game.over = true;
    if (sideInCheck) {
      game.winner = enemy(game.turn);
      game.status = `Checkmate. ${game.winner === 'w' ? 'White' : 'Black'} wins.`;
    } else {
      game.winner = null;
      game.status = 'Stalemate.';
    }
  } else {
    game.over = false;
    game.winner = null;
    game.status = sideInCheck ? `${game.turn === 'w' ? 'White' : 'Black'} is in check.` : 'Game in progress.';
  }
}

function evaluateMaterial(state, color) {
  let score = 0;
  for (const row of state.board) {
    for (const p of row) {
      if (!p) continue;
      score += (p.color === color ? 1 : -1) * PIECE_VALUES[p.type];
    }
  }
  return score;
}

function pickAiMove() {
  const color = game.turn;
  const depth = Number(difficultySelectEl.value || 2);
  const moves = getAllLegalMoves(game, color);
  if (!moves.length) return null;

  function minimax(state, ply, maximizingColor, alpha, beta) {
    const currentMoves = getAllLegalMoves(state, state.turn);
    const terminal = currentMoves.length === 0;
    if (ply === 0 || terminal) {
      if (terminal) {
        if (inCheck(state, state.turn)) return state.turn === maximizingColor ? -9999 : 9999;
        return 0;
      }
      return evaluateMaterial(state, maximizingColor);
    }

    if (state.turn === maximizingColor) {
      let best = -Infinity;
      for (const m of currentMoves) {
        const score = minimax(applyMove(state, m), ply - 1, maximizingColor, alpha, beta);
        best = Math.max(best, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
      return best;
    }

    let best = Infinity;
    for (const m of currentMoves) {
      const score = minimax(applyMove(state, m), ply - 1, maximizingColor, alpha, beta);
      best = Math.min(best, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return best;
  }

  let bestScore = -Infinity;
  let bestMove = moves[0];
  for (const move of moves) {
    const score = minimax(applyMove(game, move), depth - 1, color, -Infinity, Infinity);
    if (score > bestScore || (score === bestScore && Math.random() < 0.2)) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

function commitMove(move) {
  history.push(cloneState(game));
  game = applyMove(game, move);
  selectedSquare = null;
  legalTargets = new Map();
  evaluateGameState();
  render();
  maybeTriggerAiTurn();
}

function onSquareClick(r, c) {
  if (game.over || aiBusy) return;
  if (modeSelectEl.value === 'ai' && game.turn === 'b') return;

  const key = squareKey(r, c);
  const piece = game.board[r][c];

  // Click-to-move system: select own piece, then click highlighted legal target to execute.
  if (selectedSquare && legalTargets.has(key)) {
    commitMove(legalTargets.get(key));
    return;
  }

  if (piece && piece.color === game.turn) {
    selectedSquare = key;
    const legal = getLegalMovesForSquare(game, r, c);
    legalTargets = new Map(legal.map((m) => [squareKey(m.to.r, m.to.c), m]));
  } else {
    selectedSquare = null;
    legalTargets = new Map();
  }

  render();
}

function maybeTriggerAiTurn() {
  if (game.over || modeSelectEl.value !== 'ai' || game.turn !== 'b') return;
  aiBusy = true;
  setTimeout(() => {
    const move = pickAiMove();
    aiBusy = false;
    if (move) commitMove(move);
  }, 220);
}

function render() {
  if (schoolLogoEl && schoolLogoEl.complete && schoolLogoEl.naturalWidth > 0) {
    document.documentElement.style.setProperty('--logo-url', `url('${schoolLogoEl.src}')`);
  }

  boardEl.innerHTML = '';
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
      const key = squareKey(r, c);

      if (selectedSquare === key) btn.classList.add('selected');
      if (legalTargets.has(key)) {
        const target = game.board[r][c];
        btn.classList.add(target ? 'capture' : 'legal');
      }

      const piece = game.board[r][c];
      if (piece) {
        const pieceEl = document.createElement('span');
        pieceEl.className = 'piece';
        pieceEl.textContent = renderPiece(piece);
        btn.appendChild(pieceEl);
      }

      btn.addEventListener('click', () => onSquareClick(r, c));
      boardEl.appendChild(btn);
    }
  }

  turnIndicatorEl.textContent = game.over
    ? 'Game complete'
    : `${game.turn === 'w' ? 'White' : 'Black'} to move`;
  gameStatusEl.textContent = game.status;
}

undoBtn.addEventListener('click', () => {
  if (!history.length || aiBusy) return;
  if (modeSelectEl.value === 'ai' && history.length >= 2 && game.turn === 'w') {
    history.pop();
  }
  const previous = history.pop();
  if (!previous) return;
  game = previous;
  selectedSquare = null;
  legalTargets = new Map();
  render();
});

restartBtn.addEventListener('click', createNewGame);
modeSelectEl.addEventListener('change', () => {
  selectedSquare = null;
  legalTargets = new Map();
  render();
  maybeTriggerAiTurn();
});

fullscreenBtn.addEventListener('click', async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen?.();
  } else {
    await document.exitFullscreen?.();
  }
});

createNewGame();
