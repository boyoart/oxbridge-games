const COLORS = ["red", "blue", "yellow", "green"]; // turn order is explicitly fixed: Red -> Blue -> Yellow -> Green.
// Correct entrance ownership mapping: red/top-left, blue/top-right, yellow/bottom-right, green/bottom-left.
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
  centerHomeLogo: document.getElementById("centerHomeLogo"),
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
  victoryContainer: document.getElementById("victoryContainer"),
  brandLogo: document.getElementById("brandLogo"),
  brandFallback: document.getElementById("brandFallback")
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
let diceRollTimer = null;

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
  // User/computer ownership per color is fixed and enforced in turn engine.
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
  el.victoryContainer.innerHTML = "";
  el.setup.classList.add("hidden");
  el.game.classList.remove("hidden");
  render();
  maybeAiTurn();
}

function setupBranding() {
  // Oxbridge branding restoration with logo fallback text if image is unavailable.
  if (!el.brandLogo) return;
  el.brandLogo.onerror = () => {
    el.brandLogo.classList.add("hidden");
    el.brandFallback.classList.remove("hidden");
  };
  if (el.centerHomeLogo) {
    const logoImage = el.centerHomeLogo.querySelector("img");
    logoImage.onerror = () => el.centerHomeLogo.classList.add("hidden");
  }
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
  for (let r = 0; r < 6; r++) for (let c = 9; c < 15; c++) tile(r, c).classList.add("q-blue");
  for (let r = 9; r < 15; r++) for (let c = 0; c < 6; c++) tile(r, c).classList.add("q-green");
  for (let r = 9; r < 15; r++) for (let c = 9; c < 15; c++) tile(r, c).classList.add("q-yellow");

  boardPath = [
    [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
    [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
    [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
    [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0]
  ];
  boardPath.forEach(([r, c]) => tile(r, c).classList.add("track"));

  // Entrance tile coloring: each color entrance on outer path is fully filled with its solid color.
  Object.entries(START_INDEX).forEach(([color, idx]) => {
    const [r, c] = boardPath[idx];
    tile(r, c).classList.add(`entrance-${color}`);
  });

  // Correct home-lane mapping by quadrant direction (no blue/yellow swap): red-left, blue-up, yellow-right, green-down.
  homePaths.red = [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]];
  homePaths.blue = [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]];
  homePaths.yellow = [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]];
  homePaths.green = [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]];
  Object.entries(homePaths).forEach(([color, arr]) => arr.forEach(([r, c]) => tile(r, c).classList.add("track", `home-${color}`)));
  tile(7, 7).classList.add("center");

  placeArrows();
}

function placeArrows() {
  const arrows = [[6, 3, "right"], [3, 6, "up"], [6, 11, "right"], [3, 8, "down"], [8, 11, "left"], [11, 8, "down"], [8, 3, "left"], [11, 6, "up"]];
  arrows.forEach(([r, c, dir]) => {
    const span = document.createElement("span");
    span.className = `arrow arrow-${dir}`;
    span.setAttribute("aria-hidden", "true");
    tile(r, c).appendChild(span);
  });
}

function tile(r, c) {
  return boardCells[r * 15 + c];
}

function tokenCoord(color, pos, id) {
  const baseSlots = {
    red: [[2, 2], [2, 4], [4, 2], [4, 4]],
    blue: [[2, 10], [2, 12], [4, 10], [4, 12]],
    yellow: [[10, 10], [10, 12], [12, 10], [12, 12]],
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
  if (!current || current.finished || state.dice.rolled) return;

  // Computer and player both use this visible center-board roll animation.
  state.animating = true;
  clearInterval(diceRollTimer);
  el.diceCenter.classList.remove("rolling-return");
  el.diceCenter.classList.add("rolling", "rolling-left");
  sfx("dice-roll");
  diceRollTimer = setInterval(() => {
    setDiceFace(el.dieA, rand(1, 6));
    setDiceFace(el.dieB, rand(1, 6));
  }, 75);

  setTimeout(() => {
    clearInterval(diceRollTimer);
    // Dice generation: this is the strict two-dice source of truth for Die A and Die B.
    state.dice.a = rand(1, 6);
    state.dice.b = rand(1, 6);
    state.dice.usedA = false;
    state.dice.usedB = false;
    state.dice.rolled = true;
    state.dice.selectedBall = null;
    state.validMoves = [];
    // Dice left-roll animation completes first, then final values are revealed before return-to-center glide.
    el.diceCenter.classList.remove("rolling-left");
    el.diceCenter.classList.add("rolling-return");
    state.animating = false;
    updateBallValues();
    render();

    const playable = getPlayableBalls(current);
    if (!playable.length) setTimeout(() => endTurn(), 450);
    if (current.type === "ai") aiChooseBallAndToken();
    setTimeout(() => {
      el.diceCenter.classList.remove("rolling", "rolling-return");
    }, 560);
  }, 750);
}

function updateBallValues() {
  // Individual die values are exposed directly on the first two bottom balls.
  const [ballA, ballB, ballSum] = [...el.ballTray.querySelectorAll(".ball")];
  ballA.textContent = String(state.dice.a);
  ballB.textContent = String(state.dice.b);
  // Sum ball is assigned separately and must remain an optional third choice.
  ballSum.textContent = String(state.dice.a + state.dice.b);
}

function getAvailableBalls(_player) {
  // Ball availability is driven by die usage only: Die A, Die B, and Sum are all valid options when unused.
  // Do not force sum-only behavior when one token is already outside.

  const balls = [];
  if (!state.dice.usedA) balls.push("a");
  if (!state.dice.usedB) balls.push("b");
  if (!state.dice.usedA && !state.dice.usedB) balls.push("sum");
  return balls;
}

function getPlayableBalls(player) {
  return getAvailableBalls(player).filter((b) => getValidTokensForBall(player, b).length > 0);
}

function selectedBallValue(ball) {
  if (ball === "a") return state.dice.a;
  if (ball === "b") return state.dice.b;
  return state.dice.a + state.dice.b;
}

function canEnterFromBase(ball) {
  // Base-entry validity is checked per selected ball:
  // - Die A ball enters only when Die A is 6
  // - Die B ball enters only when Die B is 6
  // - Sum ball allows entry if either underlying die is 6
  if (ball === "a") return state.dice.a === ENTRY_ROLL;
  if (ball === "b") return state.dice.b === ENTRY_ROLL;
  return state.dice.a === ENTRY_ROLL || state.dice.b === ENTRY_ROLL;
}

function onBallSelect(ball) {
  const p = state.players[state.currentTurn];
  if (!p || p.finished || !state.dice.rolled || state.animating) return;
  if (state.mode !== "online" && p.type !== "human") return;
  if (!getPlayableBalls(p).includes(ball)) return;

  // Ball selection handling: user must confirm one move-ball before token highlight and movement.
  state.dice.selectedBall = ball;
  state.validMoves = getValidTokensForBall(p, ball);

  // Hand activation AFTER selection only: never before ball selection and never auto-click.
  // Hand guidance appears only after ball selection confirms move value.
  if (state.validMoves.length > 0) showGuideHand(p.color, state.validMoves[0]);
  else el.guideHand.classList.add("hidden");

  render();
  if (p.type === "ai") setTimeout(() => aiMoveToken(), 550);
}

function showGuideHand(color, tokenId) {
  const token = state.players[state.currentTurn]?.tokens[tokenId];
  if (!token) return;
  const [r, c] = tokenCoord(color, token.pos, token.id);
  el.guideHand.style.left = `${((c + 0.5) / 15) * 100}%`;
  el.guideHand.style.top = `${((r + 0.5) / 15) * 100 - 4}%`;
  el.guideHand.classList.remove("fade-out");
  el.guideHand.classList.remove("hidden");
}

function hideGuideHand() {
  el.guideHand.classList.add("fade-out");
  setTimeout(() => {
    el.guideHand.classList.add("hidden");
    el.guideHand.classList.remove("fade-out");
  }, 220);
}

function getValidTokensForBall(player, ball) {
  const value = selectedBallValue(ball);
  return player.tokens
    .map((t, tokenId) => ({ t, tokenId }))
    .filter(({ t }) => !player.finished && getTargetPos(t.pos, value, ball) !== null)
    // Base tokens are included in valid move detection whenever selected ball permits entry with a 6.
    // One token already outside does NOT disable entering a new token from base.
    .filter(({ t }) => (t.pos !== -1 || canEnterFromBase(ball)))
    .map((x) => x.tokenId);
}

function getTargetPos(pos, move, ball) {
  if (pos === FINAL_HOME) return null;

  // Entry rule: token can leave base only if selected ball includes at least one die with value 6.
  if (pos === -1) return canEnterFromBase(ball) ? 0 : null;

  if (pos >= 0 && pos <= HOME_TURN) {
    const toTurn = HOME_TURN - pos;
    if (move > toTurn) {
      // Home entry logic: turn into home lane with no overshoot; invalid moves are blocked.
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
  // User control enforcement: manual token movement is only allowed on user-owned turns (Red/Yellow in single mode).
  if (!p || (state.mode !== "online" && p.type !== "human")) return;
  doMoveToken(tokenId);
}

function doMoveToken(tokenId) {
  const p = state.players[state.currentTurn];
  if (!p || !state.dice.selectedBall || !state.validMoves.includes(tokenId)) return;
  const token = p.tokens[tokenId];
  const value = selectedBallValue(state.dice.selectedBall);
  const target = getTargetPos(token.pos, value, state.dice.selectedBall);
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
  hideGuideHand();

  assignPlacements();
  const more = getPlayableBalls(p).length > 0;
  if (!more || p.finished) endTurn();
  else render();
  // Computer chooses again between remaining individual die / sum options after each completed move.
  if (more && !p.finished && p.type === "ai") setTimeout(() => aiChooseBallAndToken(), 420);
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
        // Capture logic: no safe tiles; captured token returns to base in both difficulties.
        ot.pos = -1;

        // Difficulty branch: easy sends capturing token home, hard keeps capturing token on board.
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
    // Turn transitions: keep fixed order with skip-over for completed players.
    state.currentTurn = next;
  }
  state.dice = { a: 0, b: 0, usedA: false, usedB: false, rolled: false, selectedBall: null };
  state.validMoves = [];
  hideGuideHand();
  updateBallValues();
  render();
  maybeAiTurn();
}

function maybeAiTurn() {
  const p = state.players[state.currentTurn];
  if (!p || p.type !== "ai" || p.finished) return;
  // Computer dice roll animation trigger after short AI thinking delay.
  setTimeout(() => rollDice(), 700 + Math.random() * 700);
}

function aiChooseBallAndToken() {
  const p = state.players[state.currentTurn];
  if (!p || p.type !== "ai") return;
  // Computer ball/value choice logic: evaluate die A, die B, and sum and pick a valid ball/token without user input.
  const choices = getPlayableBalls(p);
  if (!choices.length) return endTurn();
  const best = pickAiChoice(p, choices);
  state.dice.selectedBall = best.ball;
  state.validMoves = best.tokens;
  render();
  setTimeout(() => aiMoveToken(), 550);
}

function aiMoveToken() {
  const p = state.players[state.currentTurn];
  if (!p || p.type !== "ai") return;
  if (!state.validMoves.length) return endTurn();
  const choice = pickAiChoice(p, [state.dice.selectedBall]);
  const tokenId = choice.tokens[0];
  setTimeout(() => doMoveToken(tokenId), 500);
}

function pickAiChoice(player, balls) {
  // Computer option scoring weighs base-entry (with 6), board advancement, and finish potential across A/B/Sum.
  const scored = [];
  balls.forEach((ball) => {
    const tokens = getValidTokensForBall(player, ball);
    tokens.forEach((tokenId) => {
      const token = player.tokens[tokenId];
      const value = selectedBallValue(ball);
      const target = getTargetPos(token.pos, value, ball);
      if (target === null) return;
      const score =
        (target === FINAL_HOME ? 1000 : 0) +
        (token.pos === -1 && target === 0 ? 300 : 0) +
        (target > token.pos ? target : 0) +
        (ball === "sum" ? 5 : 0);
      scored.push({ ball, tokenId, score });
    });
  });
  scored.sort((a, b) => b.score - a.score);
  const bestBall = scored[0]?.ball || balls[0];
  return { ball: bestBall, tokens: getValidTokensForBall(player, bestBall) };
}

function pushToVictory(color) {
  // Shared victory container placement: this renders into left panel directly under placements.
  const v = document.createElement("div");
  v.className = `victory-token ${color}`;
  state.victory.push(color);
  el.victoryContainer.appendChild(v);
}

function render() {
  setDiceFace(el.dieA, state.dice.a || 1, !state.dice.rolled);
  setDiceFace(el.dieB, state.dice.b || 1, !state.dice.rolled);
  renderBalls();
  renderPanels();
  renderBoardTokens();
  const p = state.players[state.currentTurn];
  el.turnBanner.textContent = p ? `${p.type === "human" ? "Your Turn" : "Computer Turn"} (${p.color.charAt(0).toUpperCase() + p.color.slice(1)})` : "Waiting";
}

function renderBalls() {
  const p = state.players[state.currentTurn];
  const balls = [...el.ballTray.querySelectorAll(".ball")];
  const available = p && state.dice.rolled ? getAvailableBalls(p) : [];
  const playable = p && state.dice.rolled ? getPlayableBalls(p) : [];

  balls.forEach((b) => {
    const key = b.dataset.ball;
    b.classList.toggle("disabled", !playable.includes(key));
    b.classList.toggle("selected", state.dice.selectedBall === key);
    b.classList.toggle("used", (key === "a" && state.dice.usedA) || (key === "b" && state.dice.usedB) || (key === "sum" && (state.dice.usedA || state.dice.usedB)));
    if (!state.dice.rolled) b.classList.add("disabled");
    if (!available.includes(key) && state.dice.rolled) b.classList.add("used");
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

function setDiceFace(dieNode, value, dimmed = false) {
  const map = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };
  dieNode.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const pip = document.createElement("span");
    pip.className = "pip";
    if ((map[value] || []).includes(i)) pip.classList.add("on");
    dieNode.appendChild(pip);
  }
  dieNode.style.opacity = dimmed ? "0.6" : "1";
}

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
  if (state.players[state.currentTurn]?.type !== "human") return;
  rollDice();
};

el.ballTray.querySelectorAll(".ball").forEach((b) => {
  b.onclick = () => {
    if (state.mode === "online" && !onlineCanAct()) return;
    // User control is explicitly enabled for Red/Yellow turns and blocked for computer-owned turns.
    if (state.mode !== "online" && state.players[state.currentTurn]?.type !== "human") return;
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

setupBranding();
setupBoard();
updateBallValues();
render();
