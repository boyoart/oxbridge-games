const COLORS = ["red", "blue", "green", "yellow"];
const COLOR_LABEL = { red: "Red", blue: "Blue", green: "Green", yellow: "Yellow" };
const START_INDEX = { red: 0, blue: 13, yellow: 26, green: 39 };
const SAFE_PATH_INDEX = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const PATH_LEN = 52;
const AI_MIN_DELAY_MS = 200;
const AI_MAX_DELAY_MS = 500;
const FINAL_HOME_POSITION = 58;
const ENTRY_ROLL = 6;
const BOARD_BASE_SIZE = 720;

const boardEl = document.getElementById("board");
const statusText = document.getElementById("statusText");
const roomCodeLabel = document.getElementById("roomCodeLabel");
const roomCodeValue = document.getElementById("roomCodeValue");
const scoreBoard = document.getElementById("scoreBoard");
const turnInfo = document.getElementById("turnInfo");
const rollBtn = document.getElementById("rollBtn");
const restartBtn = document.getElementById("restartBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const soundToggleBtn = document.getElementById("soundToggleBtn");
const dice1El = document.getElementById("dice1");
const dieShadowEl = document.getElementById("dieShadow");
const diceSummaryEl = document.getElementById("diceSummary");
const gameSection = document.getElementById("gameSection");
const modeMenu = document.getElementById("modeMenu");
const localConfig = document.getElementById("localConfig");
const onlineConfig = document.getElementById("onlineConfig");
const connectionStatus = document.getElementById("connectionStatus");
const board3dEl = document.getElementById("board3d");
const boardScalerEl = document.getElementById("boardScaler");

function getRequiredEl(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`[Ludo] Missing element: #${id}`);
  return el;
}

const appState = {
  mode: null,
  players: [],
  currentTurn: 0,
  dice: { value: null, rolledSix: false },
  mustMove: false,
  isRolling: false,
  winner: null,
  soundEnabled: true,
  roomCode: null,
  mySocketId: null,
  myPlayerIndex: null,
  online: { ws: null, connected: false, isHost: false, myColor: null, players: [] }
};

let boardCells = [];
let boardPath = [];
let homePaths = { red: [], blue: [], green: [], yellow: [] };

const sounds = {
  dice: new Audio("assets/sounds/dice-roll.mp3"),
  move: new Audio("assets/sounds/token-move.mp3"),
  capture: new Audio("assets/sounds/capture.mp3"),
  win: new Audio("assets/sounds/win.mp3"),
  click: new Audio("assets/sounds/click.mp3"),
  join: new Audio("assets/sounds/join-room.mp3")
};
Object.values(sounds).forEach((a) => {
  a.preload = "auto";
  a.onerror = () => {};
});

function sfx(name) {
  if (!appState.soundEnabled || !sounds[name]) return;
  const snd = sounds[name].cloneNode();
  snd.play().catch(() => {});
}

function initLogoFallbacks() {
  const logo = document.getElementById("schoolLogo");
  const fallback = document.getElementById("logoFallback");
  logo.addEventListener("error", () => {
    logo.style.display = "none";
    fallback.style.display = "block";
  });

  const boardLogo = document.getElementById("boardLogo");
  const boardFallback = document.getElementById("boardLogoFallback");
  boardLogo.addEventListener("error", () => {
    boardLogo.style.display = "none";
    boardFallback.style.display = "block";
  });
}

function setupBoard() {
  boardEl.innerHTML = "";
  boardCells = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.r = r;
      tile.dataset.c = c;
      boardEl.appendChild(tile);
      boardCells.push(tile);
    }
  }

  decorateClassicQuadrants();

  const P = [
    [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
    [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
    [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
    [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0]
  ];
  boardPath = P;
  P.forEach(([r, c], i) => {
    const t = getTile(r, c);
    t.classList.add("track");
    if (SAFE_PATH_INDEX.has(i)) t.classList.add("safe");
  });

  homePaths.red = [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]];
  homePaths.blue = [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]];
  homePaths.yellow = [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]];
  homePaths.green = [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]];

  Object.entries(homePaths).forEach(([color, tiles]) => {
    tiles.forEach(([r, c]) => {
      const tile = getTile(r, c);
      tile.classList.add("track", `home-path-${color}`);
    });
  });

  makeBase(1, 1, "red");
  makeBase(1, 10, "blue");
  makeBase(10, 1, "green");
  makeBase(10, 10, "yellow");
  paintCenterFinish();
  updateBoardScale();
}

function decorateClassicQuadrants() {
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) getTile(r, c).classList.add("quad-red");
    for (let c = 9; c < 15; c++) getTile(r, c).classList.add("quad-blue");
  }
  for (let r = 9; r < 15; r++) {
    for (let c = 0; c < 6; c++) getTile(r, c).classList.add("quad-green");
    for (let c = 9; c < 15; c++) getTile(r, c).classList.add("quad-yellow");
  }
}

function paintCenterFinish() {
  getTile(7, 7).classList.add("center-red-tri");
  getTile(7, 7).classList.add("center-blue-tri");
  getTile(7, 7).style.background = "conic-gradient(from 315deg, #e02828 0 25%, #2d53c4 25% 50%, #f0cc27 50% 75%, #1fa248 75% 100%)";
}

function makeBase(startR, startC, color) {
  const slots = [];
  for (let r = startR; r < startR + 4; r++) {
    for (let c = startC; c < startC + 4; c++) {
      const tile = getTile(r, c);
      tile.classList.add("base-zone", `base-${color}`);
      if ((r === startR + 1 || r === startR + 2) && (c === startC + 1 || c === startC + 2)) slots.push(tile);
    }
  }
  slots.forEach((tile) => {
    const slot = document.createElement("div");
    slot.className = `base-slot ${color}`;
    tile.appendChild(slot);
  });
}

function getTile(r, c) {
  return boardCells[r * 15 + c];
}

function newTokens() {
  return Array.from({ length: 4 }, (_, i) => ({ id: i, pos: -1 }));
}

function configureGame(mode, localCount = 4) {
  appState.mode = mode;
  appState.currentTurn = 0;
  appState.dice = { value: null, rolledSix: false };
  appState.mustMove = false;
  appState.isRolling = false;
  appState.winner = null;

  if (mode === "single") {
    appState.players = [
      { type: "human", color: "red", tokens: newTokens(), name: "You" },
      { type: "ai", color: "blue", tokens: newTokens(), name: "Computer Blue" },
      { type: "ai", color: "green", tokens: newTokens(), name: "Computer Green" },
      { type: "ai", color: "yellow", tokens: newTokens(), name: "Computer Yellow" }
    ];
  } else if (mode === "local") {
    appState.players = COLORS.slice(0, localCount).map((c, i) => ({ type: "human", color: c, tokens: newTokens(), name: `Player ${i + 1}` }));
  }

  modeMenu.classList.add("hidden");
  gameSection.classList.remove("hidden");
  roomCodeLabel.classList.toggle("hidden", mode !== "online");
  render();
  updateStatus();
  maybeAITurn();
  requestAnimationFrame(updateBoardScale);
}

function setSelectedMode(mode) {
  appState.mode = mode;
  if (mode === "single") {
    localConfig?.classList.add("hidden");
    onlineConfig?.classList.add("hidden");
    updateStatus("Single Player selected. Starting vs computer...");
    return;
  }
  if (mode === "local") {
    localConfig?.classList.remove("hidden");
    onlineConfig?.classList.add("hidden");
    updateStatus("Local Multiplayer selected. Choose players and start.");
    return;
  }
  if (mode === "online") {
    onlineConfig?.classList.remove("hidden");
    localConfig?.classList.add("hidden");
    updateStatus("Online Multiplayer selected. Create or join a room.");
  }
}

function render() {
  document.querySelectorAll(".token").forEach((t) => t.remove());

  appState.players.forEach((player, pIndex) => {
    player.tokens.forEach((token) => {
      const spot = getTokenCoordinates(player.color, token.pos, token.id);
      if (!spot) return;
      const tile = getTile(spot[0], spot[1]);
      const el = document.createElement("div");
      el.className = `token ${player.color}`;
      el.title = `${player.name} Token ${token.id + 1}`;
      if (isTokenClickable(pIndex, token.id)) {
        el.classList.add("clickable");
        el.addEventListener("click", () => chooseTokenMove(pIndex, token.id));
      }
      tile.appendChild(el);
    });
  });

  syncDieFace(appState.dice.value || 1);
  dice1El?.setAttribute("aria-label", `Die showing ${appState.dice.value ?? "-"}`);
  diceSummaryEl.textContent = `Die: ${appState.dice.value ?? "-"}`;

  const cp = appState.players[appState.currentTurn];
  turnInfo.textContent = cp ? `Turn: ${cp.name} (${COLOR_LABEL[cp.color]})` : "";

  if (rollBtn) rollBtn.disabled = !canCurrentPlayerRoll();

  const progress = appState.players.map((p) => ({
    name: p.name,
    color: p.color,
    homeCount: p.tokens.filter((t) => t.pos === FINAL_HOME_POSITION).length
  }));

  scoreBoard.innerHTML = progress.map((p) => `
    <li class="score-item ${p.color}">
      <span class="score-label">${p.name}</span>
      <span class="score-value">${p.homeCount}/4</span>
    </li>
  `).join("");
}

function getTokenCoordinates(color, pos, tokenId) {
  const baseMap = {
    red: [[2, 2], [2, 3], [3, 2], [3, 3]],
    blue: [[2, 11], [2, 12], [3, 11], [3, 12]],
    green: [[11, 2], [11, 3], [12, 2], [12, 3]],
    yellow: [[11, 11], [11, 12], [12, 11], [12, 12]]
  };
  if (pos === -1) return baseMap[color][tokenId];
  if (pos <= 51) return boardPath[(START_INDEX[color] + pos) % PATH_LEN];
  if (pos >= 52 && pos <= 57) return homePaths[color][pos - 52];
  if (pos === FINAL_HOME_POSITION) return [7, 7];
  return null;
}

// safe tile rule is centralized so capture/move checks always agree.
function isSafeTile(pathIndex) {
  return SAFE_PATH_INDEX.has(pathIndex);
}

// entry rule is centralized here: token leaves base only on a 6.
function canEnterBoard(rollValue) {
  return rollValue === ENTRY_ROLL;
}

// extra-turn rule is centralized here: only a 6 grants an extra turn.
function shouldGrantExtraTurn(rollValue) {
  return rollValue === ENTRY_ROLL;
}

function getTargetPosition(tokenPos, rollValue) {
  if (tokenPos === FINAL_HOME_POSITION) return null;
  if (tokenPos === -1) return canEnterBoard(rollValue) ? 0 : null;
  const target = tokenPos + rollValue;
  // exact home rule is enforced here: overshoot beyond final home is illegal.
  if (target > FINAL_HOME_POSITION) return null;
  return target;
}

function canMoveToken(playerIdx, tokenId, rollValue) {
  const token = appState.players[playerIdx]?.tokens[tokenId];
  if (!token) return false;
  return getTargetPosition(token.pos, rollValue) !== null;
}

function getValidMoves(playerIdx, rollValue) {
  const player = appState.players[playerIdx];
  if (!player) return [];
  // valid moves are calculated strictly from canMoveToken() so illegal moves are never offered.
  return player.tokens
    .map((_, i) => i)
    .filter((tokenId) => canMoveToken(playerIdx, tokenId, rollValue));
}

function isTokenClickable(playerIdx, tokenId) {
  if (!appState.mustMove || appState.winner) return false;
  const current = appState.players[appState.currentTurn];
  if (!current || current.type !== "human") return false;
  if (appState.mode === "online" && appState.myPlayerIndex !== appState.currentTurn) return false;
  if (playerIdx !== appState.currentTurn) return false;
  return canMoveToken(playerIdx, tokenId, appState.dice.value);
}

function chooseTokenMove(playerIdx, tokenId) {
  if (!isTokenClickable(playerIdx, tokenId)) return;
  applyMove(playerIdx, tokenId, appState.dice.value, true);
}

// capture rule helper: only opponents can be captured and only on non-safe tiles.
function canCapture(moverIdx, targetPos) {
  const mover = appState.players[moverIdx];
  if (!mover || targetPos < 0 || targetPos > 51) return false;
  const abs = (START_INDEX[mover.color] + targetPos) % PATH_LEN;
  if (isSafeTile(abs)) return false;

  return appState.players.some((op, idx) => idx !== moverIdx
    && op.tokens.some((token) => token.pos >= 0 && token.pos <= 51 && ((START_INDEX[op.color] + token.pos) % PATH_LEN) === abs));
}

function handleCapture(moverIdx, tokenId) {
  const mover = appState.players[moverIdx];
  const moved = mover.tokens[tokenId];
  if (moved.pos < 0 || moved.pos > 51) return false;

  const abs = (START_INDEX[mover.color] + moved.pos) % PATH_LEN;
  // safe tile rule enforced before capture resolution.
  if (isSafeTile(abs)) return false;

  let capturedAny = false;
  appState.players.forEach((op, idx) => {
    if (idx === moverIdx) return; // same-color tokens can never capture each other.
    op.tokens.forEach((t) => {
      if (t.pos < 0 || t.pos > 51) return;
      const opos = (START_INDEX[op.color] + t.pos) % PATH_LEN;
      if (opos === abs) {
        // capture rule enforced: captured opponent token returns to base immediately.
        t.pos = -1;
        capturedAny = true;
      }
    });
  });

  if (capturedAny) sfx("capture");
  return capturedAny;
}

function hasWon(playerIdx) {
  return appState.players[playerIdx].tokens.every((t) => t.pos === FINAL_HOME_POSITION);
}

function advanceTurn(extraTurn) {
  // turn switching happens here and respects extra-turn rule.
  if (!extraTurn) appState.currentTurn = (appState.currentTurn + 1) % appState.players.length;
}

function resetDiceDisplay() {
  appState.dice = { value: null, rolledSix: false };
}

function syncDieFace(faceValue) {
  if (!dice1El) return;
  const face = Math.max(1, Math.min(6, Number(faceValue) || 1));
  dice1El.className = `board-die face-${face}${appState.isRolling ? " rolling" : ""}`;
}

function applyMove(playerIdx, tokenId, rollValue, allowNetworkEmit = false) {
  const player = appState.players[playerIdx];
  const token = player.tokens[tokenId];
  const targetPos = getTargetPosition(token.pos, rollValue);

  // every move is validated before state mutation.
  if (targetPos === null) {
    updateStatus("Illegal move.");
    return;
  }

  token.pos = targetPos;
  const captured = handleCapture(playerIdx, tokenId);
  sfx("move");

  if (hasWon(playerIdx)) {
    appState.winner = playerIdx;
    statusText.textContent = `Winner: ${player.name} (${COLOR_LABEL[player.color]})!`;
    sfx("win");
    appState.mustMove = false;
  } else {
    const extraTurn = shouldGrantExtraTurn(rollValue);
    appState.mustMove = false;
    resetDiceDisplay();
    advanceTurn(extraTurn);

    if (captured) updateStatus(`${player.name} captured a token!`);
    else if (extraTurn) updateStatus("Extra turn!");
    else updateStatus("Turn changed.");
  }

  render();
  maybeAITurn();

  if (allowNetworkEmit && appState.mode === "online") {
    sendOnline({ type: "move", tokenId, player: playerIdx });
  }
}

function rollDie() {
  // one-die rule logic is enforced here: exactly one standard six-sided die is rolled.
  const value = Math.floor(Math.random() * 6) + 1;
  return { value, rolledSix: shouldGrantExtraTurn(value) };
}

function startDiceAnimation() {
  // die roll animation starts here with tumble + bounce styling.
  appState.isRolling = true;
  dice1El?.classList.add("rolling");
  dieShadowEl?.classList.add("rolling");
}

function stopDiceAnimation() {
  dice1El?.classList.remove("rolling");
  dieShadowEl?.classList.remove("rolling");
  appState.isRolling = false;
}

function handleNoValidMove(player, rollValue) {
  // valid moves are calculated and consumed here for no-move auto-turn behavior.
  updateStatus(`${player.name} rolled ${rollValue}. No valid move.`);
  appState.mustMove = false;
  resetDiceDisplay();
  advanceTurn(shouldGrantExtraTurn(rollValue));
  render();
  maybeAITurn();
}

function rollDice() {
  if (!canCurrentPlayerRoll()) return;
  if (appState.winner) return;
  const p = appState.players[appState.currentTurn];
  if (!p) return;
  if (appState.mode !== "online" && p.type !== "human" && p.type !== "ai") return;

  startDiceAnimation();
  render();
  sfx("dice");

  setTimeout(() => {
    stopDiceAnimation();

    const roll = rollDie();
    // final rolled value is assigned here and is the exact value used by game logic.
    appState.dice = roll;
    syncDieFace(roll.value);
    const moves = getValidMoves(appState.currentTurn, roll.value);

    if (!moves.length) {
      // valid move rule: no legal move ends the turn automatically.
      handleNoValidMove(p, roll.value);
      return;
    }

    appState.mustMove = true;
    updateStatus(`${p.name} rolled ${roll.value}. Move a piece.`);
    render();

    if (p.type === "ai") {
      const tokenId = pickAIMove(appState.currentTurn, moves, roll.value);
      applyMove(appState.currentTurn, tokenId, roll.value);
    }
  }, 450);
}

function maybeAITurn() {
  const p = appState.players[appState.currentTurn];
  if (!p || appState.winner) return;
  if (appState.mode === "online") return;
  if (p.type !== "ai") return;

  statusText.textContent = "Computer thinking...";
  const thinkDelay = AI_MIN_DELAY_MS + Math.floor(Math.random() * (AI_MAX_DELAY_MS - AI_MIN_DELAY_MS + 1));
  setTimeout(() => {
    rollDice();
  }, thinkDelay);
}

function pickAIMove(playerIndex, moves, rollValue) {
  const currentPlayer = appState.players[playerIndex];
  let tokenId = moves.find((i) => {
    const targetPos = getTargetPosition(currentPlayer.tokens[i].pos, rollValue);
    return targetPos !== null && canCapture(playerIndex, targetPos);
  });
  if (tokenId === undefined) tokenId = moves.find((i) => currentPlayer.tokens[i].pos === -1);
  if (tokenId === undefined) tokenId = moves[0];
  return tokenId;
}

function canCurrentPlayerRoll() {
  const p = appState.players[appState.currentTurn];
  if (!p || appState.winner || appState.mustMove || appState.isRolling) return false;
  if (appState.mode === "online") return appState.myPlayerIndex === appState.currentTurn;
  return p.type === "human" || p.type === "ai";
}

function updateStatus(message) {
  if (message) {
    statusText.textContent = message;
    return;
  }
  const p = appState.players[appState.currentTurn];
  statusText.textContent = p ? `${p.name}'s turn. Roll the die.` : "Ready.";
}

function connectOnline() {
  const wsUrl = (window.LUDO_SERVER_URL || "ws://localhost:8080");
  const ws = new WebSocket(wsUrl);
  appState.online.ws = ws;

  ws.onopen = () => {
    appState.online.connected = true;
    connectionStatus.textContent = "Connection: Online";
  };
  ws.onclose = () => {
    appState.online.connected = false;
    connectionStatus.textContent = "Connection: Disconnected";
  };
  ws.onerror = () => {
    connectionStatus.textContent = "Connection: Error";
  };

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "welcome") appState.mySocketId = msg.socketId;
    if (msg.type === "room-created") {
      appState.roomCode = msg.roomCode;
      appState.online.isHost = true;
      roomCodeValue.textContent = msg.roomCode;
      roomCodeLabel.classList.remove("hidden");
      document.getElementById("startOnlineBtn").classList.remove("hidden");
      statusText.textContent = "Room created. Waiting for players...";
      sfx("join");
    }
    if (msg.type === "room-joined") {
      appState.roomCode = msg.roomCode;
      roomCodeValue.textContent = msg.roomCode;
      roomCodeLabel.classList.remove("hidden");
      statusText.textContent = "Room joined. Waiting for host to start...";
      sfx("join");
    }
    if (msg.type === "state") {
      hydrateOnlineState(msg.state);
    }
    if (msg.type === "error") statusText.textContent = msg.message;
  };
}

function sendOnline(payload) {
  const ws = appState.online.ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ ...payload, roomCode: appState.roomCode }));
}

function hydrateOnlineState(state) {
  if (!state) return;
  appState.mode = "online";
  appState.players = state.players;
  appState.currentTurn = state.currentTurn;

  const synced = Number(state.diceValue || 0);
  appState.dice = synced > 0
    ? { value: synced, rolledSix: shouldGrantExtraTurn(synced) }
    : { value: null, rolledSix: false };

  appState.mustMove = state.mustMove;
  appState.isRolling = false;
  appState.winner = state.winner;
  appState.myPlayerIndex = Number.isInteger(state.myPlayerIndex) ? state.myPlayerIndex : appState.myPlayerIndex;
  gameSection.classList.remove("hidden");
  modeMenu.classList.add("hidden");

  statusText.textContent = state.status || "Online game synchronized.";
  render();
  requestAnimationFrame(updateBoardScale);
}

function updateBoardScale() {
  if (!board3dEl || !boardScalerEl) return;

  const styles = window.getComputedStyle(board3dEl);
  const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  const verticalPadding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
  const availableWidth = Math.max(220, board3dEl.clientWidth - horizontalPadding);

  const viewportHeight = window.innerHeight;
  const boardTop = board3dEl.getBoundingClientRect().top;
  const viewportGap = window.innerWidth <= 640 ? 6 : 14;
  const availableHeight = Math.max(220, viewportHeight - boardTop - viewportGap - verticalPadding);

  const maxSquare = Math.min(availableWidth, availableHeight);
  const boardSize = Math.min(BOARD_BASE_SIZE, maxSquare);
  board3dEl.style.setProperty("--board-size", `${Math.round(boardSize)}px`);
  board3dEl.style.minHeight = `${Math.max(230, Math.round(boardSize + verticalPadding + 10))}px`;
}

function bindUI() {
  document.querySelectorAll(".brand-btn").forEach((b) => {
    b.addEventListener("click", () => sfx("click"));
  });

  const singleBtn = getRequiredEl("singleBtn");
  const localBtn = getRequiredEl("localBtn");
  const onlineBtn = getRequiredEl("onlineBtn");
  const startLocalBtn = getRequiredEl("startLocalBtn");
  const localPlayersSelect = getRequiredEl("localPlayers");
  const createRoomBtn = getRequiredEl("createRoomBtn");
  const joinRoomBtn = getRequiredEl("joinRoomBtn");
  const roomCodeInput = getRequiredEl("roomCodeInput");
  const startOnlineBtn = getRequiredEl("startOnlineBtn");

  singleBtn?.addEventListener("click", () => {
    setSelectedMode("single");
    configureGame("single", 4);
  });

  localBtn?.addEventListener("click", () => {
    setSelectedMode("local");
  });

  onlineBtn?.addEventListener("click", () => {
    setSelectedMode("online");
    if (!appState.online.ws) connectOnline();
  });

  startLocalBtn?.addEventListener("click", () => {
    const c = Number(localPlayersSelect?.value || 4);
    configureGame("local", c);
  });

  createRoomBtn?.addEventListener("click", () => sendOnline({ type: "create-room" }));
  joinRoomBtn?.addEventListener("click", () => {
    const code = roomCodeInput?.value.trim().toUpperCase() || "";
    if (!code) return;
    appState.roomCode = code;
    sendOnline({ type: "join-room", roomCode: code });
  });
  startOnlineBtn?.addEventListener("click", () => sendOnline({ type: "start-game" }));

  rollBtn?.addEventListener("click", () => {
    if (appState.mode === "online") sendOnline({ type: "roll-request" });
    else rollDice();
  });

  restartBtn?.addEventListener("click", () => {
    if (appState.mode === "online") {
      sendOnline({ type: "restart" });
    } else if (appState.mode === "single") configureGame("single", 4);
    else if (appState.mode === "local") configureGame("local", appState.players.length || 4);
  });

  soundToggleBtn?.addEventListener("click", () => {
    appState.soundEnabled = !appState.soundEnabled;
    soundToggleBtn.textContent = `Sound: ${appState.soundEnabled ? "On" : "Off"}`;
  });

  fullscreenBtn?.addEventListener("click", async () => {
    const app = document.getElementById("app");
    if (!document.fullscreenElement) {
      await app.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
    setTimeout(updateBoardScale, 120);
  });

  window.addEventListener("resize", updateBoardScale);
  window.addEventListener("orientationchange", updateBoardScale);
  document.addEventListener("fullscreenchange", () => setTimeout(updateBoardScale, 120));
}

setupBoard();
initLogoFallbacks();
bindUI();
updateBoardScale();
updateStatus("Choose a mode, then press Start Game.");
render();
