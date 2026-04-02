const boardEl = document.getElementById('board');
const turnStatusEl = document.getElementById('turnStatus');
const gameStatusEl = document.getElementById('gameStatus');
const restartBtn = document.getElementById('restartBtn');
const undoBtn = document.getElementById('undoBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const difficultyEl = document.getElementById('difficulty');
const logo = document.getElementById('schoolLogo');
const logoWrap = document.getElementById('logoWrap');
const container = document.getElementById('gameContainer');

const pieceArt = {
  w: {
    p: 'assets/pieces/w-pawn.svg',
    n: 'assets/pieces/w-knight.svg',
    b: 'assets/pieces/w-bishop.svg',
    r: 'assets/pieces/w-rook.svg',
    q: 'assets/pieces/w-queen.svg',
    k: 'assets/pieces/w-king.svg'
  },
  b: {
    p: 'assets/pieces/b-pawn.svg',
    n: 'assets/pieces/b-knight.svg',
    b: 'assets/pieces/b-bishop.svg',
    r: 'assets/pieces/b-rook.svg',
    q: 'assets/pieces/b-queen.svg',
    k: 'assets/pieces/b-king.svg'
  }
};

const values = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const knightOffsets = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const kingOffsets = [[1, 1], [1, 0], [1, -1], [0, 1], [0, -1], [-1, 1], [-1, 0], [-1, -1]];

let state = null;
let selected = null;
let legalTargets = [];
let history = [];
let aiLocked = false;

function handleLogoFallback() {
  logoWrap.classList.add('missing');
}

logo.addEventListener('error', handleLogoFallback, { once: true });
if (logo.complete && logo.naturalWidth === 0) {
  handleLogoFallback();
}

function makePiece(color, type) {
  return { color, type, moved: false };
}

function cloneBoard(board) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
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

function newGame() {
  state = {
    board: createInitialBoard(),
    turn: 'w',
    enPassant: null,
    winner: null,
    status: 'Your turn',
    over: false,
    check: null
  };
  selected = null;
  legalTargets = [];
  history = [];
  aiLocked = false;
  render();
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function squareKey(r, c) {
  return `${r},${c}`;
}

function parseSquare(key) {
  const [r, c] = key.split(',').map(Number);
  return { r, c };
}

function getMovesForPiece(game, r, c, attackOnly = false) {
  const piece = game.board[r][c];
  if (!piece) return [];

  const moves = [];
  const dir = piece.color === 'w' ? -1 : 1;

  if (piece.type === 'p') {
    const one = r + dir;
    if (!attackOnly && inBounds(one, c) && !game.board[one][c]) {
      moves.push({ from: [r, c], to: [one, c], type: 'move' });
      const two = r + (2 * dir);
      if (!piece.moved && inBounds(two, c) && !game.board[two][c]) {
        moves.push({ from: [r, c], to: [two, c], type: 'double' });
      }
    }

    for (const dc of [-1, 1]) {
      const cr = r + dir;
      const cc = c + dc;
      if (!inBounds(cr, cc)) continue;
      const target = game.board[cr][cc];
      if (target && target.color !== piece.color) {
        moves.push({ from: [r, c], to: [cr, cc], type: 'capture' });
      }
      if (game.enPassant && game.enPassant.r === cr && game.enPassant.c === cc) {
        moves.push({ from: [r, c], to: [cr, cc], type: 'enpassant' });
      }
      if (attackOnly && inBounds(cr, cc)) {
        moves.push({ from: [r, c], to: [cr, cc], type: 'attack' });
      }
    }
  }

  if (piece.type === 'n') {
    for (const [dr, dc] of knightOffsets) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = game.board[nr][nc];
      if (!target || target.color !== piece.color) {
        moves.push({ from: [r, c], to: [nr, nc], type: target ? 'capture' : 'move' });
      }
    }
  }

  const sliders = {
    b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]
  };

  if (sliders[piece.type]) {
    for (const [dr, dc] of sliders[piece.type]) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = game.board[nr][nc];
        if (!target) {
          moves.push({ from: [r, c], to: [nr, nc], type: 'move' });
        } else {
          if (target.color !== piece.color) {
            moves.push({ from: [r, c], to: [nr, nc], type: 'capture' });
          }
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  if (piece.type === 'k') {
    for (const [dr, dc] of kingOffsets) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = game.board[nr][nc];
      if (!target || target.color !== piece.color) {
        moves.push({ from: [r, c], to: [nr, nc], type: target ? 'capture' : 'move' });
      }
    }

    if (!attackOnly && !piece.moved && !isKingInCheck(game, piece.color)) {
      const row = piece.color === 'w' ? 7 : 0;
      const rookRight = game.board[row][7];
      if (rookRight && rookRight.type === 'r' && !rookRight.moved
        && !game.board[row][5] && !game.board[row][6]
        && !isSquareAttacked(game, row, 5, piece.color)
        && !isSquareAttacked(game, row, 6, piece.color)) {
        moves.push({ from: [r, c], to: [row, 6], type: 'castle-king' });
      }

      const rookLeft = game.board[row][0];
      if (rookLeft && rookLeft.type === 'r' && !rookLeft.moved
        && !game.board[row][1] && !game.board[row][2] && !game.board[row][3]
        && !isSquareAttacked(game, row, 2, piece.color)
        && !isSquareAttacked(game, row, 3, piece.color)) {
        moves.push({ from: [r, c], to: [row, 2], type: 'castle-queen' });
      }
    }
  }

  return moves;
}

function findKing(game, color) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = game.board[r][c];
      if (piece && piece.color === color && piece.type === 'k') {
        return { r, c };
      }
    }
  }
  return null;
}

function isSquareAttacked(game, row, col, defenderColor) {
  const attacker = defenderColor === 'w' ? 'b' : 'w';
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = game.board[r][c];
      if (!p || p.color !== attacker) continue;
      const moves = getMovesForPiece(game, r, c, true);
      if (moves.some((m) => m.to[0] === row && m.to[1] === col)) {
        return true;
      }
    }
  }
  return false;
}

function isKingInCheck(game, color) {
  const king = findKing(game, color);
  if (!king) return false;
  return isSquareAttacked(game, king.r, king.c, color);
}

function applyMove(game, move) {
  const next = {
    ...game,
    board: cloneBoard(game.board),
    enPassant: null
  };

  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = { ...next.board[fr][fc] };
  next.board[fr][fc] = null;

  if (move.type === 'enpassant') {
    const capRow = piece.color === 'w' ? tr + 1 : tr - 1;
    next.board[capRow][tc] = null;
  }

  if (move.type === 'castle-king') {
    const row = piece.color === 'w' ? 7 : 0;
    const rook = { ...next.board[row][7] };
    next.board[row][7] = null;
    rook.moved = true;
    next.board[row][5] = rook;
  }

  if (move.type === 'castle-queen') {
    const row = piece.color === 'w' ? 7 : 0;
    const rook = { ...next.board[row][0] };
    next.board[row][0] = null;
    rook.moved = true;
    next.board[row][3] = rook;
  }

  if (piece.type === 'p' && Math.abs(fr - tr) === 2) {
    next.enPassant = { r: (fr + tr) / 2, c: fc };
  }

  piece.moved = true;
  if (piece.type === 'p' && (tr === 0 || tr === 7)) {
    piece.type = 'q';
  }

  next.board[tr][tc] = piece;
  next.turn = game.turn === 'w' ? 'b' : 'w';
  return next;
}

function getLegalMoves(game, color) {
  const legal = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = game.board[r][c];
      if (!piece || piece.color !== color) continue;
      const pseudo = getMovesForPiece(game, r, c, false);
      for (const move of pseudo) {
        const simulated = applyMove(game, move);
        if (!isKingInCheck(simulated, color)) {
          legal.push(move);
        }
      }
    }
  }
  return legal;
}

function updateGameStateStatus() {
  const color = state.turn;
  const legal = getLegalMoves(state, color);
  const inCheck = isKingInCheck(state, color);
  state.check = inCheck ? color : null;

  if (legal.length === 0) {
    state.over = true;
    if (inCheck) {
      state.winner = color === 'w' ? 'Computer' : 'You';
      state.status = 'Checkmate';
      gameStatusEl.textContent = `${state.status}: ${state.winner} win${state.winner === 'You' ? '' : 's'}!`;
    } else {
      state.winner = null;
      state.status = 'Draw';
      gameStatusEl.textContent = 'Draw by stalemate.';
    }
    return;
  }

  state.over = false;
  if (inCheck) {
    gameStatusEl.textContent = 'Check';
  } else {
    gameStatusEl.textContent = state.turn === 'w' ? 'Your turn' : 'Computer thinking';
  }
}

function render() {
  boardEl.innerHTML = '';

  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const sq = document.createElement('button');
      sq.type = 'button';
      sq.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
      sq.dataset.key = squareKey(r, c);

      if (selected && selected.r === r && selected.c === c) {
        sq.classList.add('selected');
      }

      const target = legalTargets.find((m) => m.to[0] === r && m.to[1] === c);
      if (target) {
        sq.classList.add(target.type.includes('capture') || target.type === 'enpassant' ? 'capture' : 'move');
      }

      if (state.check) {
        const king = findKing(state, state.check);
        if (king && king.r === r && king.c === c) {
          sq.classList.add('check');
        }
      }

      const piece = state.board[r][c];
      if (piece) {
        const img = document.createElement('img');
        img.className = 'piece';
        img.src = pieceArt[piece.color][piece.type];
        img.alt = `${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}`;
        sq.appendChild(img);
      }

      sq.addEventListener('click', onSquareClick);
      boardEl.appendChild(sq);
    }
  }

  turnStatusEl.textContent = state.turn === 'w' ? 'Your turn (White)' : 'Computer turn (Black)';
  if (state.over) {
    turnStatusEl.textContent = state.status;
  }

  if (state.over && state.status === 'Draw') {
    gameStatusEl.textContent = 'Draw';
  }
}

function onSquareClick(event) {
  if (state.over || aiLocked || state.turn !== 'w') return;

  const { r, c } = parseSquare(event.currentTarget.dataset.key);
  const piece = state.board[r][c];

  const move = legalTargets.find((m) => m.to[0] === r && m.to[1] === c);
  if (selected && move) {
    playMove(move);
    return;
  }

  if (piece && piece.color === 'w') {
    selected = { r, c };
    legalTargets = getLegalMoves(state, 'w').filter((m) => m.from[0] === r && m.from[1] === c);
  } else {
    selected = null;
    legalTargets = [];
  }

  render();
}

function playMove(move) {
  history.push(structuredClone(state));
  state = applyMove(state, move);
  selected = null;
  legalTargets = [];
  updateGameStateStatus();
  render();

  if (!state.over && state.turn === 'b') {
    requestAnimationFrame(runComputerTurn);
  }
}

function evaluate(game) {
  let score = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = game.board[r][c];
      if (!piece) continue;
      const base = values[piece.type];
      const centerBonus = (3.5 - Math.abs(3.5 - r)) + (3.5 - Math.abs(3.5 - c));
      const signed = base + (centerBonus * 4);
      score += piece.color === 'b' ? signed : -signed;
    }
  }
  return score;
}

function minimax(game, depth, alpha, beta, maximizing) {
  const color = maximizing ? 'b' : 'w';
  const moves = getLegalMoves(game, color);
  const inCheck = isKingInCheck(game, color);

  if (depth === 0 || moves.length === 0) {
    if (moves.length === 0) {
      if (inCheck) return maximizing ? -999999 : 999999;
      return 0;
    }
    return evaluate(game);
  }

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const val = minimax(applyMove(game, move), depth - 1, alpha, beta, false);
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    const val = minimax(applyMove(game, move), depth - 1, alpha, beta, true);
    best = Math.min(best, val);
    beta = Math.min(beta, val);
    if (beta <= alpha) break;
  }
  return best;
}

function chooseAIMove(game) {
  const depth = Number(difficultyEl.value);
  const moves = getLegalMoves(game, 'b');
  let bestVal = -Infinity;
  let bestMove = moves[0] || null;

  for (const move of moves) {
    const val = minimax(applyMove(game, move), Math.max(depth - 1, 0), -Infinity, Infinity, false);
    const jitter = Math.random() * 0.2;
    if (val + jitter > bestVal) {
      bestVal = val + jitter;
      bestMove = move;
    }
  }

  return bestMove;
}

function runComputerTurn() {
  aiLocked = true;
  gameStatusEl.textContent = 'Computer thinking';

  setTimeout(() => {
    if (state.over || state.turn !== 'b') {
      aiLocked = false;
      return;
    }

    const move = chooseAIMove(state);
    if (move) {
      history.push(structuredClone(state));
      state = applyMove(state, move);
    }

    updateGameStateStatus();
    aiLocked = false;
    render();
  }, 450);
}

undoBtn.addEventListener('click', () => {
  if (aiLocked || history.length === 0) return;

  if (state.turn === 'w' && history.length >= 2) {
    history.pop();
    state = history.pop();
  } else {
    state = history.pop();
  }

  selected = null;
  legalTargets = [];
  updateGameStateStatus();
  render();
});

restartBtn.addEventListener('click', newGame);

fullscreenBtn.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) {
      await container.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (_e) {
    // Some browsers block fullscreen within iframe contexts.
  }
});

newGame();
updateGameStateStatus();
render();
