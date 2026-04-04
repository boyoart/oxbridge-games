const COLORS = ["red", "blue", "yellow", "green"]; // turn order is explicitly fixed: Red -> Blue -> Yellow -> Green.
const START_INDEX = { red: 0, blue: 13, yellow: 26, green: 39 };
const PATH_LEN = 52;
const FINAL_HOME = 58;
const HOME_TURN = 48;
const ENTRY_ROLL = 6;

const el = {
  setup: document.getElementById("setupScreen"),
  game: document.getElementById("gameScreen"),
  playerName: document.getElementById("playerName"),
  difficulty: document.getElementById("difficulty"),
  singleBtn: document.getElementById("singleBtn"),
  localBtn: document.getElementById("localBtn"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  startOnlineBtn: document.getElementById("startOnlineBtn"),
  connectionStatus: document.getElementById("connectionStatus"),
  turnBanner: document.getElementById("turnBanner"),
  board: document.getElementById("board"),
  diceCenter: document.getElementById("diceCenter"),
  dieA: document.getElementById("dieA"),
  dieB: document.getElementById("dieB"),
  guideHand: document.getElementById("guideHand"),
  ballTray: document.getElementById("ballTray"),
  placements: document.getElementById("placementsPanel"),
  status: document.getElementById("statusPanel"),
  restartBtn: document.getElementById("restartBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  soundToggleBtn: document.getElementById("soundToggleBtn"),
  victoryContainer: document.getElementById("victoryContainer")
};

const audio = ["dice-roll", "token-move", "capture", "win", "click"].reduce((acc, k) => {
  const a = new Audio(`assets/sounds/${k}.mp3`);
  a.onerror = () => {};
  acc[k] = a;
  return acc;
}, {});

const state = {
  mode: null,
  difficulty: "easy",
  players: [],
  currentTurn: 0,
  dice: { a: 0, b: 0, usedA: false, usedB: false, rolled: false, selectedBall: null },
  validMoves: [],
  placements: [], // placement assignment is tracked in this ordered array.
  victory: [], // completed tokens are moved into one shared victory container.
  animating: false,
  soundOn: true,
  online: { ws: null, roomCode: "", host: false, myIndex: -1 }
};

let boardCells = [];
let boardPath = [];
let homePaths = { red: [], blue: [], yellow: [], green: [] };

function sfx(name) {
  if (!state.soundOn || !audio[name]) return;
  const snd = audio[name].cloneNode();
  snd.play().catch(() => {});
}

function newTokens() {
  return Array.from({ length: 4 }, (_, id) => ({ id, pos: -1 }));
}

function startSingle() {
  state.mode = "single";
  const name = el.playerName.value.trim() || "Scholar";
  state.difficulty = el.difficulty.value;
  state.players = [
    { color: "red", type: "human", name, tokens: newTokens(), finished: false, place: 0 },
    { color: "blue", type: "ai", name: "Computer Blue", tokens: newTokens(), finished: false, place: 0 },
    { color: "yellow", type: "human", name, tokens: newTokens(), finished: false, place: 0 },
    { color: "green", type: "ai", name: "Computer Green", tokens: newTokens(), finished: false, place: 0 }
  ]; // user and computer assignments are fixed: user=Red+Yellow, computer=Blue+Green.
  beginGame();
}

function startLocal() {
  state.mode = "local";
  const name = el.playerName.value.trim() || "Player";
  state.difficulty = el.difficulty.value;
  state.players = COLORS.map((color, i) => ({ color, type: "human", name: `${name} ${i + 1}`, tokens: newTokens(), finished: false, place: 0 }));
  beginGame();
}

function beginGame() {
  state.currentTurn = 0;
  state.dice = { a: 0, b: 0, usedA: false, usedB: false, rolled: false, selectedBall: null };
  state.validMoves = [];
  state.placements = [];
  state.victory = [];
  el.setup.classList.add("hidden");
  el.game.classList.remove("hidden");
  render();
  maybeAiTurn();
}

function setupBoard() {
  el.board.innerHTML = "";
  boardCells = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const t = document.createElement("div");
      t.className = "tile";
      t.dataset.r = r;
      t.dataset.c = c;
      el.board.appendChild(t);
      boardCells.push(t);
    }
  }
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) tile(r, c).classList.add("q-red");
  for (let r = 0; r < 6; r++) for (let c = 9; c < 15; c++) tile(r, c).classList.add("q-yellow");
  for (let r = 9; r < 15; r++) for (let c = 0; c < 6; c++) tile(r, c).classList.add("q-green");
  for (let r = 9; r < 15; r++) for (let c = 9; c < 15; c++) tile(r, c).classList.add("q-blue");

  boardPath = [
    [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
    [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
    [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
    [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0]
  ];
  boardPath.forEach(([r, c]) => tile(r, c).classList.add("track"));

  homePaths.red = [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]];
  homePaths.blue = [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]];
  homePaths.yellow = [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]];
  homePaths.green = [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]];
  Object.entries(homePaths).forEach(([color, arr]) => arr.forEach(([r, c]) => tile(r, c).classList.add("track", `home-${color}`)));
  tile(7, 7).classList.add("center");

  placeArrows();
}

function placeArrows() {
  const arrows = [[6, 3, "→"], [3, 6, "↑"], [6, 11, "→"], [3, 8, "↓"], [8, 11, "←"], [11, 8, "↓"], [8, 3, "←"], [11, 6, "↑"]];
  arrows.forEach(([r, c, a]) => {
    const span = document.createElement("span");
    span.className = "arrow";
    span.textContent = a;
    tile(r, c).appendChild(span);
  });
}

function tile(r, c) {
  return boardCells[r * 15 + c];
}

function tokenCoord(color, pos, id) {
  const baseSlots = {
    red: [[2, 2], [2, 4], [4, 2], [4, 4]],
    yellow: [[2, 10], [2, 12], [4, 10], [4, 12]],
    blue: [[10, 10], [10, 12], [12, 10], [12, 12]],
    green: [[10, 2], [10, 4], [12, 2], [12, 4]]
  };
  if (pos === -1) return baseSlots[color][id];
  if (pos >= 52 && pos < 58) return homePaths[color][pos - 52];
  if (pos >= 0 && pos <= 51) return boardPath[(START_INDEX[color] + pos) % PATH_LEN];
  return [7, 7];
}

function rollDice() {
  if (state.animating || state.online.ws) return;
  const current = state.players[state.currentTurn];
  if (!current || current.finished || current.type !== "human" || state.dice.rolled) return;

  state.animating = true;
  el.diceCenter.classList.add("rolling");
  sfx("dice-roll");
  setTimeout(() => {
    // two-dice values are generated here (Die A and Die B).
    state.dice.a = rand(1, 6);
    state.dice.b = rand(1, 6);
    state.dice.usedA = false;
    state.dice.usedB = false;
    state.dice.rolled = true;
    state.dice.selectedBall = null;
    state.validMoves = [];
    el.diceCenter.classList.remove("rolling");
    state.animating = false;
    updateBallValues();
    render();
    if (current.type === "ai") aiChooseBallAndToken();
  }, 750);
}

function updateBallValues() {
  // bottom 3-ball assignment is done here: Ball1=DieA, Ball2=DieB, Ball3=A+B.
  const [ballA, ballB, ballSum] = [...el.ballTray.querySelectorAll(".ball")];
  ballA.textContent = String(state.dice.a);
  ballB.textContent = String(state.dice.b);
  ballSum.textContent = String(state.dice.a + state.dice.b);
}

function getAvailableBalls(player) {
  const active = player.tokens.filter((t) => t.pos >= 0 && t.pos < FINAL_HOME).length;
  const balls = [];
  if (!state.dice.usedA) balls.push("a");
  if (!state.dice.usedB) balls.push("b");
  if (!state.dice.usedA && !state.dice.usedB && active === 1) balls.splice(0, balls.length, "sum");
  return balls;
}

function selectedBallValue(ball) {
  if (ball === "a") return state.dice.a;
  if (ball === "b") return state.dice.b;
  return state.dice.a + state.dice.b;
}

function onBallSelect(ball) {
  const p = state.players[state.currentTurn];
  if (!p || p.finished || !state.dice.rolled || state.animating) return;
  if (!getAvailableBalls(p).includes(ball)) return;

  // selected move-ball confirmation is handled here before tokens become clickable.
  state.dice.selectedBall = ball;
  state.validMoves = getValidTokensForBall(p, ball);

  // hand guidance is strictly triggered only after a move-ball is confirmed.
  el.guideHand.classList.toggle("hidden", state.validMoves.length === 0);
  render();

  if (p.type === "ai") setTimeout(() => aiMoveToken(), 550);
}

function getValidTokensForBall(player, ball) {
  // all valid token calculation for selected ball value is centralized here.
  const value = selectedBallValue(ball);
  return player.tokens
    .map((t, tokenId) => ({ t, tokenId }))
    .filter(({ t }) => !player.finished && getTargetPos(t.pos, value) !== null)
    .filter(({ t }) => (t.pos !== -1 || state.dice.a === ENTRY_ROLL || state.dice.b === ENTRY_ROLL))
    .map((x) => x.tokenId);
}

function getTargetPos(pos, move) {
  if (pos === FINAL_HOME) return null;
  if (pos === -1) return move === ENTRY_ROLL ? 0 : null;
  if (pos >= 0 && pos <= HOME_TURN) {
    const toTurn = HOME_TURN - pos;
    if (move > toTurn) {
      // home-entry priority turn-in rule is applied in this branch.
      const inside = move - (toTurn + 1);
      const target = 52 + inside;
      return target <= FINAL_HOME ? target : null;
    }
  }
  const target = pos + move;
  return target <= FINAL_HOME ? target : null;
}

function moveToken(tokenId) {
  const p = state.players[state.currentTurn];
  if (!p || !state.dice.selectedBall || !state.validMoves.includes(tokenId)) return;
  const token = p.tokens[tokenId];
  const value = selectedBallValue(state.dice.selectedBall);
  const target = getTargetPos(token.pos, value);
  if (target === null) return;

  token.pos = target;
  sfx("token-move");
  handleCapture(state.currentTurn, tokenId);
  if (token.pos === FINAL_HOME) pushToVictory(p.color);

  if (state.dice.selectedBall === "a") state.dice.usedA = true;
  else if (state.dice.selectedBall === "b") state.dice.usedB = true;
  else { state.dice.usedA = true; state.dice.usedB = true; }

  state.dice.selectedBall = null;
  state.validMoves = [];
  el.guideHand.classList.add("hidden");

  assignPlacements();
  const more = getAvailableBalls(p).some((b) => getValidTokensForBall(p, b).length > 0);
  if (!more || p.finished) endTurn();
  render();
}

function handleCapture(pIdx, tokenId) {
  const p = state.players[pIdx];
  const token = p.tokens[tokenId];
  if (token.pos < 0 || token.pos > 51) return;
  const abs = (START_INDEX[p.color] + token.pos) % PATH_LEN;

  state.players.forEach((op, opIdx) => {
    if (opIdx === pIdx) return;
    op.tokens.forEach((ot) => {
      if (ot.pos < 0 || ot.pos > 51) return;
      const opos = (START_INDEX[op.color] + ot.pos) % PATH_LEN;
      if (opos === abs) {
        // difficulty-based capture branch is resolved here (easy vs hard behavior).
        ot.pos = -1;
        if (state.difficulty === "easy") token.pos = FINAL_HOME;
        sfx("capture");
      }
    });
  });
}

function assignPlacements() {
  state.players.forEach((p) => {
    if (p.finished) return;
    if (p.tokens.every((t) => t.pos === FINAL_HOME)) {
      p.finished = true;
      p.place = state.placements.length + 1;
      // placement ranking is assigned immediately when a player completes all 4 tokens.
      state.placements.push({ name: p.name, color: p.color, place: p.place });
      sfx("win");
    }
  });
  if (state.players.length === 4 && state.placements.length === 3) {
    const last = state.players.find((p) => !p.finished);
    if (last) {
      last.finished = true;
      last.place = 4;
      state.placements.push({ name: last.name, color: last.color, place: 4 });
    }
  }
}

function endTurn() {
  const extra = state.dice.a === 6 && state.dice.b === 6;
  if (!extra) {
    let next = (state.currentTurn + 1) % state.players.length;
    while (state.players[next].finished) next = (next + 1) % state.players.length;
    // player/computer turn transition is resolved in fixed order with finished-player skipping.
    state.currentTurn = next;
  }
  state.dice = { a: 0, b: 0, usedA: false, usedB: false, rolled: false, selectedBall: null };
  state.validMoves = [];
  maybeAiTurn();
}

function maybeAiTurn() {
  const p = state.players[state.currentTurn];
  if (!p || p.type !== "ai" || p.finished) return;
  setTimeout(() => rollDice(), 700 + Math.random() * 700);
}

function aiChooseBallAndToken() {
  const p = state.players[state.currentTurn];
  const choices = getAvailableBalls(p).filter((b) => getValidTokensForBall(p, b).length > 0);
  if (!choices.length) return endTurn();
  setTimeout(() => onBallSelect(choices[0]), 500);
}

function aiMoveToken() {
  const p = state.players[state.currentTurn];
  if (!p || p.type !== "ai") return;
  if (!state.validMoves.length) return endTurn();
  const tokenId = state.validMoves[0];
  setTimeout(() => moveToken(tokenId), 500);
}

function pushToVictory(color) {
  // completed token transfer to shared victory container is rendered here.
  const v = document.createElement("div");
  v.className = `victory-token ${color}`;
  state.victory.push(color);
  el.victoryContainer.appendChild(v);
}

function render() {
  el.dieA.textContent = state.dice.a || "•";
  el.dieB.textContent = state.dice.b || "•";
  renderBalls();
  renderPanels();
  renderBoardTokens();
  const p = state.players[state.currentTurn];
  el.turnBanner.textContent = p ? `${p.name} (${p.color.toUpperCase()}) turn` : "Waiting";
}

function renderBalls() {
  const p = state.players[state.currentTurn];
  const balls = [...el.ballTray.querySelectorAll(".ball")];
  const avail = p && state.dice.rolled ? getAvailableBalls(p) : [];
  balls.forEach((b) => {
    const key = b.dataset.ball;
    b.classList.toggle("disabled", !avail.includes(key));
    b.classList.toggle("selected", state.dice.selectedBall === key);
  });
}

function renderPanels() {
  el.placements.innerHTML = `<h3>Placements</h3>${state.placements.map((p) => `<div>${p.place}${suffix(p.place)} - ${p.name}</div>`).join("") || "<div>None yet</div>"}`;
  const rows = state.players.map((p) => {
    const active = p.tokens.filter((t) => t.pos >= 0 && t.pos < FINAL_HOME).length;
    const home = p.tokens.filter((t) => t.pos === FINAL_HOME).length;
    return `<div><b>${p.name}</b> (${p.color})<br/>Active ${active}/4 · Home ${home}/4${p.place ? ` · ${p.place}${suffix(p.place)}` : ""}</div><hr/>`;
  }).join("");
  el.status.innerHTML = `<h3>Token Status</h3>${rows}`;
}

function renderBoardTokens() {
  el.board.querySelectorAll(".token").forEach((n) => n.remove());
  state.players.forEach((p, pIdx) => {
    p.tokens.forEach((t) => {
      if (t.pos === FINAL_HOME) return;
      const [r, c] = tokenCoord(p.color, t.pos, t.id);
      const tok = document.createElement("button");
      tok.className = `token ${p.color}`;
      if (pIdx === state.currentTurn && state.validMoves.includes(t.id)) tok.classList.add("valid");
      tok.onclick = () => moveToken(t.id);
      tile(r, c).appendChild(tok);
    });
  });
}

function suffix(n) { return n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"; }
function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

// --- online mode (kept working with backend protocol) ---
function openSocket() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.hostname}:8080`);
  ws.onopen = () => el.connectionStatus.textContent = "Connection: Online";
  ws.onclose = () => el.connectionStatus.textContent = "Connection: Offline";
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "room-created") {
      state.online.roomCode = msg.roomCode;
      el.connectionStatus.textContent = `Room ${msg.roomCode} created`;
      state.online.host = true;
      el.startOnlineBtn.classList.remove("hidden");
    }
    if (msg.type === "room-joined") {
      state.online.roomCode = msg.roomCode;
      el.connectionStatus.textContent = `Joined room ${msg.roomCode}`;
    }
    if (msg.type === "state") syncFromServer(msg.state);
  };
  state.online.ws = ws;
}

function syncFromServer(s) {
  state.mode = "online";
  state.difficulty = s.difficulty || "easy";
  state.players = s.players.map((p) => ({ ...p }));
  state.currentTurn = s.currentTurn;
  state.online.myIndex = s.myPlayerIndex;
  state.dice.a = s.diceValues?.[0] || 0;
  state.dice.b = s.diceValues?.[1] || 0;
  state.dice.usedA = !!s.diceUsed?.[0];
  state.dice.usedB = !!s.diceUsed?.[1];
  state.dice.rolled = !!(s.diceValues?.[0] || s.diceValues?.[1]);
  state.placements = (s.placements || []).map((x) => ({ ...x, name: state.players[x.playerIndex]?.name || "Player" }));
  el.setup.classList.add("hidden");
  el.game.classList.remove("hidden");
  updateBallValues();
  render();
}

function onlineRoll() {
  if (!state.online.ws) return;
  state.online.ws.send(JSON.stringify({ type: "roll-request", roomCode: state.online.roomCode }));
}

function onlineMove(tokenId) {
  if (!state.online.ws || !state.dice.selectedBall) return;
  const payload = { type: "move", roomCode: state.online.roomCode, tokenId, usedCombined: state.dice.selectedBall === "sum" };
  if (state.dice.selectedBall === "a") payload.dieIndex = 0;
  if (state.dice.selectedBall === "b") payload.dieIndex = 1;
  state.online.ws.send(JSON.stringify(payload));
  state.dice.selectedBall = null;
  state.validMoves = [];
}

function onlineCanAct() {
  return state.mode === "online" && state.online.myIndex === state.currentTurn;
}

el.singleBtn.onclick = () => { sfx("click"); startSingle(); };
el.localBtn.onclick = () => { sfx("click"); startLocal(); };
el.createRoomBtn.onclick = () => {
  if (!state.online.ws) openSocket();
  setTimeout(() => state.online.ws?.send(JSON.stringify({ type: "create-room" })), 150);
};
el.joinRoomBtn.onclick = () => {
  if (!state.online.ws) openSocket();
  const roomCode = el.roomCodeInput.value.trim().toUpperCase();
  setTimeout(() => state.online.ws?.send(JSON.stringify({ type: "join-room", roomCode })), 150);
};
el.startOnlineBtn.onclick = () => {
  state.online.ws?.send(JSON.stringify({ type: "start-game", roomCode: state.online.roomCode, difficulty: el.difficulty.value }));
};

el.diceCenter.onclick = () => {
  if (state.mode === "online") {
    if (onlineCanAct()) onlineRoll();
    return;
  }
  rollDice();
};

el.ballTray.querySelectorAll(".ball").forEach((b) => {
  b.onclick = () => {
    if (state.mode === "online" && !onlineCanAct()) return;
    onBallSelect(b.dataset.ball);
  };
});

el.board.onclick = (ev) => {
  const tok = ev.target.closest(".token");
  if (!tok) return;
  const parent = tok.parentElement;
  const tokens = [...parent.querySelectorAll(".token")];
  const idxInCell = tokens.indexOf(tok);
  if (state.mode === "online") {
    if (!onlineCanAct()) return;
    onlineMove(idxInCell);
  }
};

el.restartBtn.onclick = () => {
  if (state.mode === "online") {
    state.online.ws?.send(JSON.stringify({ type: "restart", roomCode: state.online.roomCode }));
    return;
  }
  beginGame();
};
el.fullscreenBtn.onclick = () => document.documentElement.requestFullscreen?.();
el.soundToggleBtn.onclick = () => {
  state.soundOn = !state.soundOn;
  el.soundToggleBtn.textContent = state.soundOn ? "Sound On" : "Sound Off";
};

setupBoard();
render();
