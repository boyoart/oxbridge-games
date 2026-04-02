const COLORS = ["red", "blue", "green", "yellow"];
const COLOR_LABEL = { red: "Red", blue: "Blue", green: "Green", yellow: "Yellow" };
const START_INDEX = { red: 0, blue: 13, yellow: 26, green: 39 };
const SAFE_PATH_INDEX = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const ENTRY_ROLL = 6;
const PATH_LEN = 52;
const HOME_STEPS = 6;

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
const diceEl = document.getElementById("dice");
const gameSection = document.getElementById("gameSection");
const modeMenu = document.getElementById("modeMenu");
const localConfig = document.getElementById("localConfig");
const onlineConfig = document.getElementById("onlineConfig");
const connectionStatus = document.getElementById("connectionStatus");

const appState = {
  mode: null,
  players: [],
  currentTurn: 0,
  diceValue: null,
  mustMove: false,
  winner: null,
  soundEnabled: true,
  roomCode: null,
  mySocketId: null,
  online: { ws: null, connected: false, isHost: false, myColor: null, players: [] }
};

let boardCells = [];
let boardPath = [];
let homePaths = { red: [], blue: [], green: [], yellow: [] };

const sounds = {
  // dice roll sound usage
  dice: new Audio("assets/sounds/dice-roll.mp3"),
  // token move sound usage
  move: new Audio("assets/sounds/token-move.mp3"),
  // capture sound usage
  capture: new Audio("assets/sounds/capture.mp3"),
  // win sound usage
  win: new Audio("assets/sounds/win.mp3"),
  // button click sound usage
  click: new Audio("assets/sounds/click.mp3"),
  // join room / game start optional sound usage
  join: new Audio("assets/sounds/join-room.mp3")
};
Object.values(sounds).forEach(a => {
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

  const P = [
    [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
    [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]
  ];
  boardPath = P;
  P.forEach(([r,c], i) => {
    const t = getTile(r,c);
    t.classList.add("track");
    if (SAFE_PATH_INDEX.has(i)) t.classList.add("safe");
  });

  homePaths.red = [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]];
  homePaths.blue = [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]];
  homePaths.yellow = [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]];
  homePaths.green = [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]];

  Object.entries(homePaths).forEach(([color, tiles]) => {
    tiles.forEach(([r,c]) => getTile(r,c).classList.add(`home-path-${color}`));
  });

  makeBase(1,1,"red");
  makeBase(1,10,"blue");
  makeBase(10,1,"green");
  makeBase(10,10,"yellow");
}

function makeBase(startR, startC, color) {
  for (let r = startR; r < startR + 4; r++) {
    for (let c = startC; c < startC + 4; c++) {
      const tile = getTile(r,c);
      tile.classList.add("base-zone", `base-${color}`);
    }
  }
}

function getTile(r, c) {
  return boardCells[r * 15 + c];
}

function newTokens() {
  return Array.from({ length: 4 }, (_, i) => ({ id: i, pos: -1 })); // -1 base, 0..57 path/home, 58 finished
}

function configureGame(mode, localCount = 4) {
  appState.mode = mode;
  appState.currentTurn = 0;
  appState.diceValue = null;
  appState.mustMove = false;
  appState.winner = null;

  if (mode === "single") {
    appState.players = [
      { type: "human", color: "red", tokens: newTokens(), name: "You" },
      { type: "ai", color: "blue", tokens: newTokens(), name: "Computer Blue" },
      { type: "ai", color: "green", tokens: newTokens(), name: "Computer Green" },
      { type: "ai", color: "yellow", tokens: newTokens(), name: "Computer Yellow" }
    ];
  } else if (mode === "local") {
    appState.players = COLORS.slice(0, localCount).map((c, i) => ({ type: "human", color: c, tokens: newTokens(), name: `Player ${i+1}` }));
  }

  modeMenu.classList.add("hidden");
  gameSection.classList.remove("hidden");
  roomCodeLabel.classList.toggle("hidden", mode !== "online");
  render();
  updateStatus();
  maybeAITurn();
}

function render() {
  document.querySelectorAll(".token").forEach(t => t.remove());

  appState.players.forEach((player, pIndex) => {
    player.tokens.forEach(token => {
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

  diceEl.textContent = appState.diceValue ?? "-";
  const cp = appState.players[appState.currentTurn];
  turnInfo.textContent = cp ? `Turn: ${cp.name} (${COLOR_LABEL[cp.color]})` : "";
  scoreBoard.innerHTML = appState.players.map(p => {
    const homeCount = p.tokens.filter(t => t.pos === 58).length;
    return `<li>${p.name}: ${homeCount}/4 home</li>`;
  }).join("");
}

function getTokenCoordinates(color, pos, tokenId) {
  const baseMap = {
    red: [[2,2],[2,3],[3,2],[3,3]],
    blue: [[2,11],[2,12],[3,11],[3,12]],
    green: [[11,2],[11,3],[12,2],[12,3]],
    yellow: [[11,11],[11,12],[12,11],[12,12]]
  };
  if (pos === -1) return baseMap[color][tokenId];
  if (pos <= 51) return boardPath[(START_INDEX[color] + pos) % PATH_LEN];
  if (pos >= 52 && pos <= 57) return homePaths[color][pos - 52];
  if (pos === 58) return [7,7];
  return null;
}

function isTokenClickable(playerIdx, tokenId) {
  if (!appState.mustMove || appState.winner) return false;
  const current = appState.players[appState.currentTurn];
  if (!current || current.type !== "human") return false;
  if (playerIdx !== appState.currentTurn) return false;
  return isMoveValid(playerIdx, tokenId, appState.diceValue);
}

function isMoveValid(playerIdx, tokenId, roll) {
  const token = appState.players[playerIdx].tokens[tokenId];
  if (token.pos === 58) return false;
  if (token.pos === -1) return roll === ENTRY_ROLL;
  const target = token.pos + roll;
  return target <= 58;
}

function chooseTokenMove(playerIdx, tokenId) {
  if (!isTokenClickable(playerIdx, tokenId)) return;
  applyMove(playerIdx, tokenId, appState.diceValue, true);
}

function applyMove(playerIdx, tokenId, roll, allowNetworkEmit = false) {
  const p = appState.players[playerIdx];
  const token = p.tokens[tokenId];
  const oldPos = token.pos;
  token.pos = token.pos === -1 ? 0 : token.pos + roll;
  if (token.pos === 58) token.pos = 58;

  handleCapture(playerIdx, tokenId);
  sfx("move");

  if (checkWinner(playerIdx)) {
    appState.winner = playerIdx;
    statusText.textContent = `Winner: ${p.name} (${COLOR_LABEL[p.color]})!`;
    sfx("win");
    appState.mustMove = false;
  } else {
    const extraTurn = roll === 6;
    appState.mustMove = false;
    appState.diceValue = null;
    if (!extraTurn) appState.currentTurn = (appState.currentTurn + 1) % appState.players.length;
    updateStatus(extraTurn ? `${p.name} rolled 6: extra turn.` : "Turn changed.");
  }

  render();
  maybeAITurn();

  if (allowNetworkEmit && appState.mode === "online") {
    sendOnline({ type: "move", tokenId, oldPos, player: playerIdx });
  }
}

function handleCapture(moverIdx, tokenId) {
  const mover = appState.players[moverIdx];
  const moved = mover.tokens[tokenId];
  if (moved.pos < 0 || moved.pos > 51) return;
  const abs = (START_INDEX[mover.color] + moved.pos) % PATH_LEN;
  if (SAFE_PATH_INDEX.has(abs)) return;

  appState.players.forEach((op, idx) => {
    if (idx === moverIdx) return;
    op.tokens.forEach(t => {
      if (t.pos < 0 || t.pos > 51) return;
      const opos = (START_INDEX[op.color] + t.pos) % PATH_LEN;
      if (opos === abs) {
        t.pos = -1;
        sfx("capture");
        statusText.textContent = `${mover.name} captured a token!`;
      }
    });
  });
}

function checkWinner(pIndex) {
  return appState.players[pIndex].tokens.every(t => t.pos === 58);
}

function rollDice(emit = false) {
  if (appState.winner) return;
  const p = appState.players[appState.currentTurn];
  if (!p) return;
  if (appState.mode !== "online" && p.type !== "human") return;

  const value = Math.floor(Math.random() * 6) + 1;
  diceEl.classList.add("rolling");
  sfx("dice");
  setTimeout(() => {
    diceEl.classList.remove("rolling");
    appState.diceValue = value;
    const moves = validMovesFor(appState.currentTurn, value);
    if (!moves.length) {
      updateStatus(`${p.name} rolled ${value}. No valid moves.`);
      appState.diceValue = null;
      if (value !== 6) appState.currentTurn = (appState.currentTurn + 1) % appState.players.length;
      render();
      maybeAITurn();
    } else {
      appState.mustMove = true;
      updateStatus(`${p.name} rolled ${value}. Move a piece.`);
      render();
    }

    if (emit && appState.mode === "online") sendOnline({ type: "roll", value });
  }, 650);
}

function validMovesFor(playerIdx, roll) {
  const p = appState.players[playerIdx];
  return p.tokens.map((t, i) => ({ i, valid: isMoveValid(playerIdx, i, roll) })).filter(x => x.valid).map(x => x.i);
}

function maybeAITurn() {
  const p = appState.players[appState.currentTurn];
  if (!p || appState.winner) return;
  if (appState.mode === "online") return;
  if (p.type !== "ai") return;

  statusText.textContent = "Computer thinking...";
  setTimeout(() => {
    rollDice(false);
    setTimeout(() => {
      const roll = appState.diceValue;
      const moves = validMovesFor(appState.currentTurn, roll || 0);
      if (!moves.length) return;

      let tokenId = moves.find(i => canCaptureWithMove(appState.currentTurn, i, roll));
      if (tokenId === undefined) tokenId = moves.find(i => appState.players[appState.currentTurn].tokens[i].pos === -1);
      if (tokenId === undefined) tokenId = moves[0];
      applyMove(appState.currentTurn, tokenId, roll);
    }, 900);
  }, 700);
}

function canCaptureWithMove(playerIdx, tokenId, roll) {
  const p = appState.players[playerIdx];
  const t = p.tokens[tokenId];
  const npos = t.pos === -1 ? 0 : t.pos + roll;
  if (npos > 51 || npos < 0) return false;
  const abs = (START_INDEX[p.color] + npos) % PATH_LEN;
  if (SAFE_PATH_INDEX.has(abs)) return false;
  return appState.players.some((op, idx) => idx !== playerIdx && op.tokens.some(ot => ot.pos >= 0 && ot.pos <= 51 && ((START_INDEX[op.color] + ot.pos) % PATH_LEN) === abs));
}

function updateStatus(message) {
  if (message) {
    statusText.textContent = message;
    return;
  }
  const p = appState.players[appState.currentTurn];
  statusText.textContent = p ? `${p.name}'s turn. Roll the dice.` : "Ready.";
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
  appState.diceValue = state.diceValue;
  appState.mustMove = state.mustMove;
  appState.winner = state.winner;
  gameSection.classList.remove("hidden");
  modeMenu.classList.add("hidden");

  statusText.textContent = state.status || "Online game synchronized.";
  render();
}

function bindUI() {
  document.querySelectorAll(".brand-btn").forEach(b => {
    b.addEventListener("click", () => sfx("click"));
  });

  document.getElementById("singleBtn").addEventListener("click", () => configureGame("single", 4));
  document.getElementById("localBtn").addEventListener("click", () => {
    localConfig.classList.toggle("hidden");
    onlineConfig.classList.add("hidden");
  });
  document.getElementById("onlineBtn").addEventListener("click", () => {
    onlineConfig.classList.toggle("hidden");
    localConfig.classList.add("hidden");
    if (!appState.online.ws) connectOnline();
  });
  document.getElementById("startLocalBtn").addEventListener("click", () => {
    const c = Number(document.getElementById("localPlayers").value);
    configureGame("local", c);
  });

  document.getElementById("createRoomBtn").addEventListener("click", () => sendOnline({ type: "create-room" }));
  document.getElementById("joinRoomBtn").addEventListener("click", () => {
    const code = document.getElementById("roomCodeInput").value.trim().toUpperCase();
    if (!code) return;
    appState.roomCode = code;
    sendOnline({ type: "join-room", roomCode: code });
  });
  document.getElementById("startOnlineBtn").addEventListener("click", () => sendOnline({ type: "start-game" }));

  rollBtn.addEventListener("click", () => {
    if (appState.mode === "online") sendOnline({ type: "roll-request" });
    else rollDice();
  });

  restartBtn.addEventListener("click", () => {
    if (appState.mode === "online") {
      sendOnline({ type: "restart" });
    } else if (appState.mode === "single") configureGame("single", 4);
    else if (appState.mode === "local") configureGame("local", appState.players.length || 4);
  });

  soundToggleBtn.addEventListener("click", () => {
    appState.soundEnabled = !appState.soundEnabled;
    soundToggleBtn.textContent = `Sound: ${appState.soundEnabled ? "On" : "Off"}`;
  });

  fullscreenBtn.addEventListener("click", async () => {
    const app = document.getElementById("app");
    if (!document.fullscreenElement) {
      await app.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  });
}

setupBoard();
initLogoFallbacks();
bindUI();
updateStatus("Choose a mode, then press Start Game.");
