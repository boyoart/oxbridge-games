const boardEl = document.getElementById('board');
const turnIndicatorEl = document.getElementById('turnIndicator');
const gameStatusEl = document.getElementById('gameStatus');
const whiteTimerEl = document.getElementById('whiteTimer');
const blackTimerEl = document.getElementById('blackTimer');
const whitePanelEl = document.getElementById('whitePanel');
const blackPanelEl = document.getElementById('blackPanel');
const undoBtn = document.getElementById('undoBtn');
const restartBtn = document.getElementById('restartBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const soundBtn = document.getElementById('soundBtn');
const modeSelectEl = document.getElementById('modeSelect');
const difficultySelectEl = document.getElementById('difficultySelect');
const timeControlEl = document.getElementById('timeControl');
const schoolLogoEl = document.getElementById('schoolLogo');
const gameLayoutEl = document.getElementById('gameLayout');

const values = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const knightOffsets = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const kingOffsets = [[1, 1], [1, 0], [1, -1], [0, 1], [0, -1], [-1, 1], [-1, 0], [-1, -1]];

let state;
// Selected piece state is stored globally so click-to-move always uses one source of truth.
let selected = null;
let legalTargets = [];
let turnLegalMoves = [];
let history = [];
let nextPieceId = 1;
let aiLocked = false;
let timerInterval = null;
let lastTick = 0;
let soundEnabled = true;
let assetLoadVersion = 0;
let fbxRuntimePromise = null;

const pieceAssetCache = new Map();
const pieceAssetById = new Map();
const PIECE_NAME_BY_TYPE = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const PIECE_FILE_BY_TYPE = { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };

const audio = {
  move: new Audio('assets/sounds/move.mp3'),
  capture: new Audio('assets/sounds/capture.mp3'),
  click: new Audio('assets/sounds/click.mp3')
};

function safePlay(kind) {
  if (!soundEnabled || !audio[kind]) return;
  try {
    audio[kind].currentTime = 0;
    audio[kind].play().catch(() => {});
  } catch (_e) {
    // Ignore autoplay/missing audio issues.
  }
}

function makePiece(color, type) {
  return { id: `p${nextPieceId++}`, color, type, moved: false };
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
  const initial = Number(timeControlEl.value || 300000);
  state = {
    board: createInitialBoard(),
    turn: 'w',
    enPassant: null,
    status: 'In progress',
    winner: null,
    over: false,
    check: null,
    clocks: { w: initial, b: initial }
  };
  selected = null;
  legalTargets = [];
  history = [];
  aiLocked = false;
  updateGameStateStatus();
  // Legal move generation for click interaction is refreshed once per turn.
  turnLegalMoves = getLegalMoves(state, state.turn);
  render();
}

function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function squareKey(r, c) { return `${r},${c}`; }
function parseSquare(k) { const [r, c] = k.split(',').map(Number); return { r, c }; }
function modeIsAI() { return modeSelectEl.value === 'ai'; }
function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const min = String(Math.floor(total / 60)).padStart(2, '0');
  const sec = String(total % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

function pieceSvg(color, type) {
  // Piece materials/colors are assigned here for premium 3D-like silhouettes.
  const isLight = color === 'w';
  const body = isLight ? '#fff9ef' : '#5f4ca5';
  const bodyMid = isLight ? '#edd8bc' : '#7d99d7';
  const edge = isLight ? '#4e3e4d' : '#1e1c3b';
  const shine = isLight ? 'rgba(255,255,255,0.86)' : 'rgba(241,232,255,0.55)';
  const glow = isLight ? 'rgba(244,166,193,0.34)' : 'rgba(158,203,255,0.36)';

  const paths = {
    p: '<ellipse cx="50" cy="34" rx="10" ry="10"/><path d="M36 73 C39 56,44 48,50 45 C56 48,61 56,64 73 Z"/>',
    n: '<path d="M34 74 C34 56,39 40,47 30 C57 23,68 28,67 40 C60 39,55 43,54 49 C57 51,62 54,63 60 C60 67,53 72,45 73 C41 73,38 74,34 74 Z"/><circle cx="58" cy="37" r="2.5"/>',
    b: '<ellipse cx="50" cy="29" rx="8" ry="10"/><path d="M50 16 L50 25 M45 20 L55 20" stroke-width="2.8" stroke-linecap="round"/><path d="M35 73 C37 56,42 45,50 35 C58 45,63 56,65 73 Z"/>',
    r: '<path d="M34 74 L34 42 L40 36 L60 36 L66 42 L66 74 Z"/><path d="M33 42 L30 34 L38 34 L42 28 L46 34 L54 34 L58 28 L62 34 L70 34 L67 42 Z"/>',
    q: '<path d="M34 74 C36 57,40 45,50 36 C60 45,64 57,66 74 Z"/><circle cx="36" cy="30" r="4"/><circle cx="50" cy="25" r="4"/><circle cx="64" cy="30" r="4"/>',
    k: '<path d="M34 74 C37 56,41 44,50 33 C59 44,63 56,66 74 Z"/><path d="M50 16 L50 32 M43 24 L57 24" stroke-width="3" stroke-linecap="round"/>'
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${type}">
    <defs>
      <radialGradient id="body" cx="30%" cy="24%" r="78%">
        <stop offset="0%" stop-color="${shine}"/>
        <stop offset="58%" stop-color="${body}"/>
        <stop offset="100%" stop-color="${bodyMid}"/>
      </radialGradient>
      <linearGradient id="base" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${body}"/>
        <stop offset="100%" stop-color="${bodyMid}"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="83" rx="30" ry="10" fill="${glow}"/>
    <ellipse cx="50" cy="80" rx="27" ry="9" fill="url(#base)" stroke="${edge}" stroke-width="2.1"/>
    <g fill="url(#body)" stroke="${edge}" stroke-width="2.2" stroke-linejoin="round">${paths[type]}</g>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getPieceAssetDescriptor(piece) {
  // Real uploaded lowercase asset roots (do not change):
  // /games/chess/assets/chess/pieces/white/
  // /games/chess/assets/chess/pieces/black/
  const side = piece.color === 'w' ? 'white' : 'black';
  const pieceName = PIECE_NAME_BY_TYPE[piece.type];
  const fileName = PIECE_FILE_BY_TYPE[piece.type];
  const pieceId = `${side}-${pieceName}`;
  // Exact FBX filename mapping (e.g. white bishop => /games/chess/assets/chess/pieces/white/Bishop.fbx).
  const fbxPath = `/games/chess/assets/chess/pieces/${side}/${fileName}.fbx`;
  const pngPath = `/games/chess/assets/chess/pieces/${side}/${fileName}.png`;
  return {
    pieceId,
    fbxPath,
    pngCandidate: pngPath
  };
}

async function assetExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return true;
  } catch (_e) {
    // Some static hosts do not support HEAD requests; fall through to GET.
  }

  try {
    const res = await fetch(url, { method: 'GET' });
    return res.ok;
  } catch (_e) {
    return false;
  }
}

function ensureFbxRuntime() {
  if (fbxRuntimePromise) return fbxRuntimePromise;
  fbxRuntimePromise = Promise.all([
    import('https://unpkg.com/three@0.160.0/build/three.module.js'),
    import('https://unpkg.com/three@0.160.0/examples/jsm/loaders/FBXLoader.js')
  ]).then(([threeMod, loaderMod]) => ({ THREE: threeMod, FBXLoader: loaderMod.FBXLoader }));
  return fbxRuntimePromise;
}

async function renderFbxPreview(path) {
  const { THREE, FBXLoader } = await ensureFbxRuntime();
  const size = 192;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
  camera.position.set(0, 2.2, 6.2);
  camera.lookAt(0, 1.4, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
  keyLight.position.set(5, 9, 4);
  scene.add(keyLight);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.setClearAlpha(0);

  const loader = new FBXLoader();
  const object = await loader.loadAsync(path);
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
      if (Array.isArray(child.material)) child.material.forEach((mat) => { mat.transparent = false; });
      else if (child.material) child.material.transparent = false;
    }
  });
  scene.add(object);

  const box = new THREE.Box3().setFromObject(object);
  const sizeVec = box.getSize(new THREE.Vector3());
  const maxAxis = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;
  const targetHeight = 3.15;
  const scale = targetHeight / maxAxis;
  object.scale.setScalar(scale);

  const centeredBox = new THREE.Box3().setFromObject(object);
  const center = centeredBox.getCenter(new THREE.Vector3());
  object.position.sub(center);
  object.position.y -= centeredBox.min.y;

  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/png');
  renderer.dispose();
  return dataUrl;
}

function loadPieceAsset(piece) {
  const descriptor = getPieceAssetDescriptor(piece);
  if (pieceAssetCache.has(descriptor.pieceId)) return pieceAssetCache.get(descriptor.pieceId);

  // FBX-first fallback chain is resolved once and cached per logical piece ID.
  const loader = (async () => {
    // FBX loader call starts here (primary renderer path).
    console.log('Trying FBX:', descriptor.fbxPath);
    if (await assetExists(descriptor.fbxPath)) {
      try {
        const previewUrl = await renderFbxPreview(descriptor.fbxPath);
        console.log('FBX loaded:', descriptor.pieceId, descriptor.fbxPath);
        return { kind: 'fbx', url: previewUrl, sourceUrl: descriptor.fbxPath, descriptor };
      } catch (_e) {
        console.log('FBX failed, falling back:', descriptor.pieceId, descriptor.fbxPath);
      }
    }

    if (await assetExists(descriptor.pngCandidate)) return { kind: 'png', url: descriptor.pngCandidate, descriptor };
    // Old SVG/internal renderers remain disabled when FBX succeeds; this only runs after FBX failure.
    return { kind: 'internal-svg', url: null, descriptor };
  })();

  pieceAssetCache.set(descriptor.pieceId, loader);
  return loader;
}

function scheduleAssetRefresh() {
  const token = ++assetLoadVersion;
  Promise.resolve().then(() => {
    if (token === assetLoadVersion) render();
  });
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
      if (!piece.moved && inBounds(two, c) && !game.board[two][c]) moves.push({ from: [r, c], to: [two, c], type: 'double' });
    }
    for (const dc of [-1, 1]) {
      const cr = r + dir;
      const cc = c + dc;
      if (!inBounds(cr, cc)) continue;
      const target = game.board[cr][cc];
      if (target && target.color !== piece.color) moves.push({ from: [r, c], to: [cr, cc], type: 'capture' });
      if (game.enPassant && game.enPassant.r === cr && game.enPassant.c === cc) moves.push({ from: [r, c], to: [cr, cc], type: 'enpassant' });
      if (attackOnly) moves.push({ from: [r, c], to: [cr, cc], type: 'attack' });
    }
  }

  if (piece.type === 'n') {
    for (const [dr, dc] of knightOffsets) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = game.board[nr][nc];
      if (!target || target.color !== piece.color) moves.push({ from: [r, c], to: [nr, nc], type: target ? 'capture' : 'move' });
    }
  }

  const sliders = { b: [[1, 1], [1, -1], [-1, 1], [-1, -1]], r: [[1, 0], [-1, 0], [0, 1], [0, -1]], q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]] };
  if (sliders[piece.type]) {
    for (const [dr, dc] of sliders[piece.type]) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = game.board[nr][nc];
        if (!target) moves.push({ from: [r, c], to: [nr, nc], type: 'move' });
        else {
          if (target.color !== piece.color) moves.push({ from: [r, c], to: [nr, nc], type: 'capture' });
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
      if (!target || target.color !== piece.color) moves.push({ from: [r, c], to: [nr, nc], type: target ? 'capture' : 'move' });
    }

    if (!attackOnly && !piece.moved && !isKingInCheck(game, piece.color)) {
      const row = piece.color === 'w' ? 7 : 0;
      const rookRight = game.board[row][7];
      if (rookRight && rookRight.type === 'r' && !rookRight.moved && !game.board[row][5] && !game.board[row][6]
        && !isSquareAttacked(game, row, 5, piece.color) && !isSquareAttacked(game, row, 6, piece.color)) {
        moves.push({ from: [r, c], to: [row, 6], type: 'castle-king' });
      }
      const rookLeft = game.board[row][0];
      if (rookLeft && rookLeft.type === 'r' && !rookLeft.moved && !game.board[row][1] && !game.board[row][2] && !game.board[row][3]
        && !isSquareAttacked(game, row, 2, piece.color) && !isSquareAttacked(game, row, 3, piece.color)) {
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
      if (piece && piece.color === color && piece.type === 'k') return { r, c };
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
      if (moves.some((m) => m.to[0] === row && m.to[1] === col)) return true;
    }
  }
  return false;
}

function isKingInCheck(game, color) {
  const king = findKing(game, color);
  return king ? isSquareAttacked(game, king.r, king.c, color) : false;
}

function applyMove(game, move) {
  const next = { ...game, board: cloneBoard(game.board), enPassant: null, clocks: { ...game.clocks } };
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
    const rook = { ...next.board[row][7], moved: true };
    next.board[row][7] = null;
    next.board[row][5] = rook;
  }

  if (move.type === 'castle-queen') {
    const row = piece.color === 'w' ? 7 : 0;
    const rook = { ...next.board[row][0], moved: true };
    next.board[row][0] = null;
    next.board[row][3] = rook;
  }

  if (piece.type === 'p' && Math.abs(fr - tr) === 2) next.enPassant = { r: (fr + tr) / 2, c: fc };
  piece.moved = true;
  if (piece.type === 'p' && (tr === 0 || tr === 7)) piece.type = 'q';

  next.board[tr][tc] = piece;
  next.turn = game.turn === 'w' ? 'b' : 'w';
  return next;
}

function getLegalMoves(game, color) {
  // Legal moves are generated here for all piece types, then filtered by king-safety simulation.
  const legal = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = game.board[r][c];
      if (!piece || piece.color !== color) continue;
      const pseudo = getMovesForPiece(game, r, c, false);
      for (const move of pseudo) {
        const simulated = applyMove(game, move);
        if (!isKingInCheck(simulated, color)) legal.push(move);
      }
    }
  }
  return legal;
}

function updateGameStateStatus() {
  if (state.over) return;
  const color = state.turn;
  const legal = getLegalMoves(state, color);
  const inCheck = isKingInCheck(state, color);
  state.check = inCheck ? color : null;

  if (legal.length === 0) {
    state.over = true;
    if (inCheck) {
      state.status = 'Checkmate';
      state.winner = color === 'w' ? 'Black' : 'White';
      gameStatusEl.textContent = `Checkmate. ${state.winner} wins.`;
    } else {
      state.status = 'Draw';
      state.winner = null;
      gameStatusEl.textContent = 'Draw by stalemate.';
    }
    return;
  }

  if (inCheck) gameStatusEl.textContent = `${color === 'w' ? 'White' : 'Black'} in check.`;
  else if (modeIsAI() && color === 'b') gameStatusEl.textContent = 'Computer thinking...';
  else gameStatusEl.textContent = 'Game in progress.';
}

function evaluate(game) {
  let score = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = game.board[r][c];
      if (!piece) continue;
      const base = values[piece.type];
      const center = (3.5 - Math.abs(3.5 - r)) + (3.5 - Math.abs(3.5 - c));
      const signed = base + center * 4;
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
    if (moves.length === 0) return inCheck ? (maximizing ? -999999 : 999999) : 0;
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
  const depth = Number(difficultySelectEl.value || 2);
  const moves = getLegalMoves(game, 'b');
  let bestMove = moves[0] || null;
  let bestVal = -Infinity;
  for (const move of moves) {
    const value = minimax(applyMove(game, move), Math.max(depth - 1, 0), -Infinity, Infinity, false);
    const jitter = Math.random() * 0.2;
    if (value + jitter > bestVal) {
      bestVal = value + jitter;
      bestMove = move;
    }
  }
  return bestMove;
}

function runComputerTurn() {
  if (!modeIsAI()) return;
  aiLocked = true;
  setTimeout(() => {
    if (state.over || state.turn !== 'b' || !modeIsAI()) {
      aiLocked = false;
      return;
    }
    const move = chooseAIMove(state);
    if (move) {
      history.push(structuredClone(state));
      const wasCapture = Boolean(state.board[move.to[0]][move.to[1]]) || move.type === 'enpassant';
      state = applyMove(state, move);
      safePlay(wasCapture ? 'capture' : 'move');
    }
    updateGameStateStatus();
    turnLegalMoves = state.over ? [] : getLegalMoves(state, state.turn);
    aiLocked = false;
    render();
  }, 380);
}

function describeMoveHint(move, game) {
  const targetPiece = game.board[move.to[0]][move.to[1]];
  return targetPiece || move.type === 'enpassant' ? 'capture' : 'move';
}

// Piece rendering logic rebuilt as a dedicated component-style creator.
function createPieceElement(piece, square) {
  const wrap = document.createElement('span');
  wrap.className = 'piece-wrap';
  wrap.dataset.pieceId = piece.id;
  wrap.dataset.square = squareKey(square.r, square.c);
  wrap.draggable = false;
  wrap.setAttribute('aria-label', `${piece.color === 'w' ? 'White' : 'Black'} ${PIECE_NAME_BY_TYPE[piece.type]}`);

  const img = document.createElement('img');
  img.className = 'piece';
  img.alt = `${piece.color === 'w' ? 'White' : 'Black'} ${PIECE_NAME_BY_TYPE[piece.type]}`;

  // Fallback renderer is immediately available to avoid interaction blocking while external assets resolve.
  img.src = pieceSvg(piece.color, piece.type);
  wrap.appendChild(img);

  const descriptor = getPieceAssetDescriptor(piece);
  const cached = pieceAssetById.get(descriptor.pieceId);
  if (cached) {
    wrap.dataset.assetKind = cached.kind;
    if (cached.kind === 'fbx' || cached.kind === 'png') img.src = cached.url;
    if (cached.kind === 'fbx') {
      wrap.dataset.modelUrl = cached.sourceUrl;
      wrap.classList.add('piece-model-ready');
    }
  } else {
    loadPieceAsset(piece).then((result) => {
      pieceAssetById.set(result.descriptor.pieceId, result);
      scheduleAssetRefresh();
    });
  }

  return wrap;
}

function render() {
  // Jitter fix: render board from a single deterministic board-state snapshot (no drag/FLIP transform mixing).
  boardEl.innerHTML = '';

  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const sq = document.createElement('button');
      sq.type = 'button';
      sq.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
      sq.dataset.key = squareKey(r, c);

      if (selected && selected.r === r && selected.c === c) sq.classList.add('selected');
      const target = legalTargets.find((m) => m.to[0] === r && m.to[1] === c);
      if (target) {
        const hintType = describeMoveHint(target, state);
        sq.classList.add(hintType);
        // Legal-move highlight layer is explicit DOM to avoid pseudo-element conflicts with dark-square logos.
        const marker = document.createElement('span');
        marker.className = `move-marker ${hintType}`;
        marker.setAttribute('aria-hidden', 'true');
        sq.appendChild(marker);
      }

      if (state.check) {
        const king = findKing(state, state.check);
        if (king && king.r === r && king.c === c) sq.classList.add('check');
      }

      const piece = state.board[r][c];
      if (piece) {
        const wrap = createPieceElement(piece, { r, c });
        sq.appendChild(wrap);
      }

      boardEl.appendChild(sq);
    }
  }

  whiteTimerEl.textContent = formatTime(state.clocks.w);
  blackTimerEl.textContent = formatTime(state.clocks.b);
  whitePanelEl.classList.toggle('active', !state.over && state.turn === 'w');
  blackPanelEl.classList.toggle('active', !state.over && state.turn === 'b');
  turnIndicatorEl.textContent = state.over ? state.status : `${state.turn === 'w' ? 'White' : 'Black'} to move`;

  if (modeIsAI()) {
    const side = state.turn === 'w' ? 'You (White)' : 'Computer (Black)';
    gameStatusEl.textContent = state.over ? gameStatusEl.textContent : `${side} · ${difficultySelectEl.selectedOptions[0].textContent}`;
  } else {
    gameStatusEl.textContent = state.over ? gameStatusEl.textContent : 'Local 2 Player mode';
  }
}

function activeHumanColor() {
  if (!modeIsAI()) return state.turn;
  return state.turn === 'w' ? 'w' : null;
}

function playMove(move) {
  // Move execution: commit exactly one move and update board state exactly once.
  history.push(structuredClone(state));
  const wasCapture = Boolean(state.board[move.to[0]][move.to[1]]) || move.type === 'enpassant';
  state = applyMove(state, move);
  selected = null;
  legalTargets = [];
  updateGameStateStatus();
  turnLegalMoves = state.over ? [] : getLegalMoves(state, state.turn);
  safePlay(wasCapture ? 'capture' : 'move');
  render();

  if (!state.over && modeIsAI() && state.turn === 'b') {
    requestAnimationFrame(runComputerTurn);
  }
}

function onSquareClick(event) {
  if (state.over || aiLocked) return;
  const humanColor = activeHumanColor();
  if (!humanColor) return;

  const { r, c } = parseSquare(event.currentTarget.dataset.key);
  const piece = state.board[r][c];
  // Click-to-move is bound to board square state (not direct mesh hit testing), so FBX click issues do not block play.
  // Valid moves are generated from one legal-move source so every piece uses the same move rules.
  const allLegalMoves = (humanColor === state.turn) ? turnLegalMoves : getLegalMoves(state, humanColor);
  // Move validation trigger: destination must exist in the legal target list.
  const move = legalTargets.find((m) => m.to[0] === r && m.to[1] === c);

  if (selected && move) {
    // Destination click triggers exactly one move and one board-state update.
    playMove(move);
    return;
  }

  // Click-to-select logic: selecting a friendly piece replaces any prior selection.
  if (piece && piece.color === humanColor) {
    selected = { r, c };
    legalTargets = allLegalMoves.filter((m) => m.from[0] === r && m.from[1] === c);
  } else {
    selected = null;
    legalTargets = [];
  }

  render();
}

// Click-to-select and click-to-move interaction controller.
function onBoardClick(event) {
  const squareEl = event.target.closest('.square');
  if (!squareEl || !boardEl.contains(squareEl)) return;
  onSquareClick({ currentTarget: squareEl });
}

function declareTimeout(loser) {
  state.over = true;
  state.status = 'Time';
  state.winner = loser === 'w' ? 'Black' : 'White';
  gameStatusEl.textContent = `${state.winner} wins on time.`;
}

function tickTimers() {
  if (!state || state.over || aiLocked) return;
  const now = performance.now();
  const delta = now - lastTick;
  lastTick = now;

  state.clocks[state.turn] -= delta;
  if (state.clocks[state.turn] <= 0) {
    state.clocks[state.turn] = 0;
    declareTimeout(state.turn);
  }
  render();
}

function startTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  lastTick = performance.now();
  timerInterval = setInterval(tickTimers, 100);
}

undoBtn.addEventListener('click', () => {
  safePlay('click');
  if (aiLocked || history.length === 0) return;

  if (modeIsAI() && state.turn === 'w' && history.length >= 2) {
    history.pop();
    state = history.pop();
  } else {
    state = history.pop();
  }

  selected = null;
  legalTargets = [];
  aiLocked = false;
  updateGameStateStatus();
  turnLegalMoves = state.over ? [] : getLegalMoves(state, state.turn);
  render();
});

restartBtn.addEventListener('click', () => {
  safePlay('click');
  newGame();
  startTimerLoop();
});

soundBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundBtn.textContent = `Sound: ${soundEnabled ? 'On' : 'Off'}`;
  safePlay('click');
});

fullscreenBtn.addEventListener('click', async () => {
  safePlay('click');
  try {
    if (!document.fullscreenElement) await gameLayoutEl.requestFullscreen();
    else await document.exitFullscreen();
  } catch (_e) {
    // Browser may block fullscreen depending on sandbox.
  }
});

modeSelectEl.addEventListener('change', () => {
  newGame();
});

difficultySelectEl.addEventListener('change', () => {
  render();
});

timeControlEl.addEventListener('change', () => {
  newGame();
  startTimerLoop();
});

schoolLogoEl.addEventListener('load', () => {
  // School logo asset loaded and injected for engraved dark-square pattern.
  document.documentElement.style.setProperty('--logo-url', `url("${schoolLogoEl.currentSrc || schoolLogoEl.src}")`);
}, { once: true });

if (schoolLogoEl.complete && schoolLogoEl.naturalWidth > 0) {
  document.documentElement.style.setProperty('--logo-url', `url("${schoolLogoEl.currentSrc || schoolLogoEl.src}")`);
}

boardEl.addEventListener('click', onBoardClick);
// Unstable drag/drop interaction has been intentionally disabled in favor of stable click-to-move.

newGame();
startTimerLoop();
