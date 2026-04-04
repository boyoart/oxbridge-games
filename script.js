const COLORS = ["red", "blue", "yellow", "green"];
// Side ownership model (forced): USER controls Red+Yellow, COMPUTER controls Blue+Green.
const SIDE_BY_COLOR = { red: "user", yellow: "user", blue: "computer", green: "computer" };
const SIDE_ORDER = ["user", "computer"];
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

const audio = ["token-move", "capture", "win", "click"].reduce((acc, k) => {
  const a = new Audio(`assets/sounds/${k}.mp3`);
  a.onerror = () => {};
  acc[k] = a;
  return acc;
}, {});
const rollSound = new Audio("assets/sounds/dice-roll.mp3");
rollSound.preload = "auto";
rollSound.onerror = () => console.warn("Dice roll audio failed to load from assets/sounds/dice-roll.mp3");
rollSound.load();
let hasUserInteracted = false;

const state = {
  mode: null,
  difficulty: "easy",
  players: [],
  // Alternating side turn model only: USER -> COMPUTER -> USER -> COMPUTER.
  currentSide: "user",
  currentTurn: 0,
  // Die state is tracked per output: Die A, Die B, and Sum availability/legality are separated.
  dice: {
    a: 0, b: 0, usedA: false, usedB: false,
    sumAvailable: false,
    hasLegalA: false, hasLegalB: false, hasLegalSum: false, hasRemainingLegalMove: false,
    rolled: false, selectedBall: null
  },
  // Valid moves for selected ball span both colors controlled by the active side.
  validMoves: [],
  placements: [], // placement assignment is tracked in this ordered array.
  victory: [], // completed tokens are moved into one shared victory container.
  movingToken: null,
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

function unlockRollSound() {
  if (hasUserInteracted) return;
  hasUserInteracted = true;
  rollSound.volume = 0;
  rollSound.play()
    .then(() => {
      rollSound.pause();
      rollSound.currentTime = 0;
      rollSound.volume = 1;
    })
    .catch(() => {
      rollSound.volume = 1;
    });
}

function playRollSound() {
  if (!state.soundOn) return;
  rollSound.currentTime = 0;
  rollSound.play().catch(() => {});
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
  state.currentSide = "user";
  state.currentTurn = 0;
  state.dice = {
    a: 0, b: 0, usedA: false, usedB: false,
    sumAvailable: false,
    hasLegalA: false, hasLegalB: false, hasLegalSum: false, hasRemainingLegalMove: false,
    rolled: false, selectedBall: null
  };
  state.validMoves = [];
  state.placements = [];
  state.victory = [];
  el.victoryContainer.innerHTML = "";
  el.setup.classList.add("hidden");
  el.game.classList.remove("hidden");
  render();
  maybeAiTurn();
}

function sidePlayers(side) {
  return state.players.filter((p) => SIDE_BY_COLOR[p.color] === side);
}

function activeSidePlayers() {
  return sidePlayers(state.currentSide);
}

function isSideFinished(side) {
  const players = sidePlayers(side);
  return players.length > 0 && players.every((p) => p.finished);
}

function activeSideType() {
  return state.currentSide === "user" ? "human" : "ai";
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

function verifyDiceSoundPath() {
  fetch("assets/sounds/dice-roll.mp3", { method: "HEAD" })
    .then((res) => {
      if (!res.ok) console.warn("Dice sound path check failed:", res.status);
    })
    .catch(() => console.warn("Dice sound path check failed: network error"));
}

function setupBoard() {
  el.board.innerHTML = "";
  boardCells = [];
  const fragment = document.createDocumentFragment();
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const t = document.createElement("div");
      t.className = "tile";
      t.dataset.r = r;
      t.dataset.c = c;
      fragment.appendChild(t);
      boardCells.push(t);
    }
  }
  el.board.appendChild(fragment);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) tile(r, c).classList.add("q-red");
  for (let r = 0; r < 6; r++) for (let c = 9; c < 15; c++) tile(r, c).classList.add("q-blue");
  for (let r = 9; r < 15; r++) for (let c = 0; c < 6; c++) tile(r, c).classList.add("q-green");
  for (let r = 9; r < 15; r++) for (let c = 9; c < 15; c++) tile(r, c).classList.add("q-yellow");
  addBaseWatermarks();

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
  console.log("Board initialized");
}

function addBaseWatermarks() {
  el.board.querySelectorAll(".base-watermark").forEach((n) => n.remove());
  ["red", "blue", "yellow", "green"].forEach((color) => {
    // Base tile logo placement: one school logo watermark per solid-color base quadrant.
    const wrap = document.createElement("div");
    wrap.className = `base-watermark ${color}`;
    // Base logo visual rules (100% opacity + drop shadow + behind tokens) are controlled by CSS.
    wrap.innerHTML = '<img src="assets/logo/logo.png" alt="" aria-hidden="true" />';
    // Pointer-events disabled so base logos never interfere with token interactivity.
    wrap.style.pointerEvents = "none";
    el.board.appendChild(wrap);
  });
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
  if (isSideFinished(state.currentSide) || state.dice.rolled) return;

  // Computer and player both use this visible center-board roll animation.
  state.animating = true;
  clearInterval(diceRollTimer);
  el.diceCenter.classList.remove("rolling-return");
  el.diceCenter.classList.add("rolling", "rolling-left");
  playRollSound();
  diceRollTimer = setInterval(() => {
    setDiceFace(el.dieA, rand(1, 6));
    setDiceFace(el.dieB, rand(1, 6));
  }, 75);

  setTimeout(() => {
    clearInterval(diceRollTimer);
    // Dice generation: this is the strict two-dice source of truth for Die A and Die B.
    state.dice.a = rand(1, 6);
    state.dice.b = rand(1, 6);
    console.log("Dice rolled:", [state.dice.a, state.dice.b]);
    state.dice.usedA = false;
    state.dice.usedB = false;
    state.dice.sumAvailable = true;
    state.dice.rolled = true;
    state.dice.selectedBall = null;
    state.validMoves = [];
    // Dice left-roll animation completes first, then final values are revealed before return-to-center glide.
    el.diceCenter.classList.remove("rolling-left");
    el.diceCenter.classList.add("rolling-return");
    state.animating = false;
    updateBallValues();
    render();

    const playable = getPlayableBalls(state.currentSide);
    if (!playable.length) {
      // One-roll-per-turn rule: if this roll has no legal move, the turn ends (no reroll-until-6 loop).
      setTimeout(() => endTurn(), 450);
    } else if (activeSideType() === "ai") {
      aiChooseBallAndToken();
    }
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

function getAvailableBalls() {
  // DieA/DieB/sum availability is tracked independently and never collapsed into one shared "used" flag.

  const balls = [];
  if (!state.dice.usedA) balls.push("a");
  if (!state.dice.usedB) balls.push("b");
  if (state.dice.sumAvailable) balls.push("sum");
  return balls;
}

function getForcedCombinedMove(side) {
  if (!side || !state.dice.rolled) return null;
  // Combined-total forcing is valid only while the sum ball is still active.
  // If one die was already consumed (e.g., a 6 used for base entry), do NOT force sum resolution.
  if (!state.dice.sumAvailable) return null;
  if (hasBaseEntryOption(side)) return null;
  const moveValue = state.dice.a + state.dice.b;
  const activeMovable = sidePlayers(side).flatMap((player) => player.tokens
    .map((token) => ({ color: player.color, tokenId: token.id, token }))
    // One-active-token rule scope: count only tokens currently active on the board for the active side.
    .filter(({ token }) => token.pos >= 0 && token.pos < FINAL_HOME)
    .filter(({ color, token }) => {
      // Combined-total move is the only legal move candidate when exactly one active token exists.
      const target = getTargetPos(token.pos, moveValue, "sum");
      return target !== null && isLandingLegalForSide(color, target);
    }));
  return activeMovable.length === 1 ? { color: activeMovable[0].color, tokenId: activeMovable[0].tokenId } : null;
}

function hasBaseEntryOption(side) {
  if (!side || !state.dice.rolled) return false;
  const hasUsableSix = (!state.dice.usedA && state.dice.a === ENTRY_ROLL) || (!state.dice.usedB && state.dice.b === ENTRY_ROLL);
  if (!hasUsableSix) return false;
  return sidePlayers(side).some((player) => player.tokens.some((token) => token.pos === -1));
}

function getPlayableBalls(side) {
  const forcedCombined = getForcedCombinedMove(side);
  if (forcedCombined) {
    // One-active-token rule: bypass split/single-die options and force the combined-total ball.
    return state.dice.sumAvailable && getValidMovesForBall(side, "sum").length > 0 ? ["sum"] : [];
  }
  return getAvailableBalls().filter((b) => getValidMovesForBall(side, b).length > 0);
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
  // - Sum ball is movement-only (A+B) and does not directly perform a base-entry action
  if (ball === "a") return state.dice.a === ENTRY_ROLL;
  if (ball === "b") return state.dice.b === ENTRY_ROLL;
  return false;
}

function onBallSelect(ball) {
  if (!state.dice.rolled || state.animating || isSideFinished(state.currentSide)) return;
  if (state.mode !== "online" && activeSideType() !== "human") return;
  if (!getPlayableBalls(state.currentSide).includes(ball)) return;
  if (getForcedCombinedMove(state.currentSide) && ball !== "sum") return;

  // User-side token choice is enabled by ball-first flow:
  // once a ball is selected, every valid token for that exact ball remains selectable (no auto-forced token).
  state.dice.selectedBall = ball;
  // Selected ball value is applied from the 3-ball system (Ball 1=Die A, Ball 2=Die B, Ball 3=Sum).
  // Valid move highlighting spans both colors controlled by the active side.
  state.validMoves = getValidMovesForBall(state.currentSide, ball);

  // Hand must not auto-trigger before token selection; only valid token highlighting happens here.
  el.guideHand.classList.add("hidden");

  render();
  if (activeSideType() === "ai") setTimeout(() => aiMoveToken(), 550);
}

function showGuideHand(color, tokenId) {
  const player = state.players.find((p) => p.color === color);
  const token = player?.tokens[tokenId];
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

function getValidMovesForBall(side, ball) {
  const forcedCombined = getForcedCombinedMove(side);
  if (forcedCombined && ball !== "sum") return [];
  const value = selectedBallValue(ball);
  const validMoves = sidePlayers(side).flatMap((player) => player.tokens
    .map((t, tokenId) => ({ playerColor: player.color, t, tokenId }))
    .filter(({ t }) => !player.finished && getTargetPos(t.pos, value, ball) !== null)
    .filter(({ t }) => {
      const target = getTargetPos(t.pos, value, ball);
      return target !== null && isLandingLegalForSide(player.color, target);
    })
    .filter(({ t }) => (t.pos !== -1 || canEnterFromBase(ball)))
    .map(({ playerColor, tokenId }) => ({ color: playerColor, tokenId })));
  if (!forcedCombined) return validMoves;
  // When one-active-token rule applies, only that single token remains valid for selection.
  return validMoves.filter((m) => m.color === forcedCombined.color && m.tokenId === forcedCombined.tokenId);
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

function isSameSide(colorA, colorB) {
  return SIDE_BY_COLOR[colorA] === SIDE_BY_COLOR[colorB];
}

function isLandingLegalForSide(movingColor, targetPos) {
  // Side-based no-friendly-capture rule is enforced by USER/COMPUTER ownership, not color equality.
  if (targetPos < 0 || targetPos > 51) return true;
  const abs = (START_INDEX[movingColor] + targetPos) % PATH_LEN;
  for (const p of state.players) {
    for (const t of p.tokens) {
      if (t.pos < 0 || t.pos > 51) continue;
      const otherAbs = (START_INDEX[p.color] + t.pos) % PATH_LEN;
      if (otherAbs !== abs) continue;
      if (isSameSide(movingColor, p.color)) return true;
      return true;
    }
  }
  return true;
}

function moveToken(color, tokenId) {
  if (SIDE_BY_COLOR[color] !== state.currentSide) return;
  if (state.mode !== "online" && activeSideType() !== "human") return;
  doMoveToken({ color, tokenId });
}

async function doMoveToken(move) {
  const p = state.players.find((player) => player.color === move.color);
  if (!p || !state.dice.selectedBall) return;
  const forcedCombined = getForcedCombinedMove(state.currentSide);
  if (forcedCombined && state.dice.selectedBall !== "sum") {
    // One-active-token rule: force the combined-total resolution even if an individual die was previously selected.
    state.dice.selectedBall = "sum";
    state.validMoves = getValidMovesForBall(state.currentSide, "sum");
  }
  const isValid = state.validMoves.some((m) => m.color === move.color && m.tokenId === move.tokenId);
  if (!isValid) return;
  if (state.animating) return;
  const token = p.tokens[move.tokenId];
  const value = selectedBallValue(state.dice.selectedBall);
  const target = getTargetPos(token.pos, value, state.dice.selectedBall);
  if (target === null) return;

  state.animating = true;
  state.movingToken = { color: move.color, tokenId: move.tokenId };
  const startPos = token.pos;
  render();
  await animateHandTokenMove(move.color, token.id, startPos, target);

  // Token state updates after movement: once the hand places the token, commit destination into game state.
  token.pos = target;
  sfx("token-move");
  // Final landing tile is already computed in `target`; capture check must happen only after this full move resolves.
  handleCapture(move.color, move.tokenId);
  if (token.pos === FINAL_HOME) pushToVictory(p.color);

  // Used-vs-remaining ball state handling:
  // - Die A move consumes only A
  // - Die B move consumes only B
  // - Sum consumes both A and B together
  // Remaining die logic continues after one die is used: consuming A/B leaves the other die intact.
  if (state.dice.selectedBall === "a") {
    // Consuming only Die A (including base-entry on a rolled 6) keeps Die B active for follow-up moves.
    state.dice.usedA = true;
    state.dice.sumAvailable = false;
  } else if (state.dice.selectedBall === "b") {
    // Consuming only Die B keeps Die A active for follow-up moves when legal.
    state.dice.usedB = true;
    state.dice.sumAvailable = false;
  } else {
    state.dice.usedA = true;
    state.dice.usedB = true;
    state.dice.sumAvailable = false;
  }

  state.dice.selectedBall = null;
  state.validMoves = [];
  state.movingToken = null;
  state.animating = false;
  hideGuideHand();

  assignPlacements();
  // One-roll-per-turn rule: after one valid move from this roll, end the turn.
  // (Only endTurn's double-6 check can keep the same side active.)
  endTurn();
}

function handleCapture(color, tokenId) {
  const p = state.players.find((player) => player.color === color);
  const token = p.tokens[tokenId];
  if (token.pos < 0 || token.pos > 51) return;
  // Intermediate tiles are traversal-only; capture evaluates only on the token's final landing tile.
  const abs = (START_INDEX[p.color] + token.pos) % PATH_LEN;
  // Stacked-token capture rule: select only one enemy token deterministically (player iteration order, then token id order).
  let captured = null;
  for (const op of state.players) {
    if (op.color === color) continue;
    // Capture is blocked for same-team tokens (Red/Yellow allies, Blue/Green allies).
    if (isSameSide(p.color, op.color)) continue;
    for (const ot of op.tokens) {
      if (ot.pos < 0 || ot.pos > 51) continue;
      const opos = (START_INDEX[op.color] + ot.pos) % PATH_LEN;
      if (opos === abs) {
        captured = ot;
        break;
      }
    }
    if (captured) break;
  }

  if (!captured) return;
  // Capture resolution removes exactly one token from a stack and returns only that token to base.
  captured.pos = -1;
  // Remaining stacked token(s) stay on the landing tile and are rendered in-place on next render pass.

  // Difficulty branch applies only on enemy captures: easy sends capturing token home, hard keeps it on board.
  if (state.difficulty === "easy") token.pos = FINAL_HOME;
  sfx("capture");
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
    // Turn passes to the other side after the current side's single-roll turn resolution.
    let idx = SIDE_ORDER.indexOf(state.currentSide);
    do {
      idx = (idx + 1) % SIDE_ORDER.length;
      state.currentSide = SIDE_ORDER[idx];
    } while (isSideFinished(state.currentSide));
  } else {
    // Double-6 exception: grant an extra turn to the same side.
  }
  state.dice = {
    a: 0, b: 0, usedA: false, usedB: false,
    sumAvailable: false,
    hasLegalA: false, hasLegalB: false, hasLegalSum: false, hasRemainingLegalMove: false,
    rolled: false, selectedBall: null
  };
  state.validMoves = [];
  hideGuideHand();
  updateBallValues();
  render();
  maybeAiTurn();
}

function maybeAiTurn() {
  if (activeSideType() !== "ai" || isSideFinished(state.currentSide)) return;
  // Computer dice roll animation trigger after short AI thinking delay.
  setTimeout(() => rollDice(), 700 + Math.random() * 700);
}

function aiChooseBallAndToken() {
  if (activeSideType() !== "ai") return;
  // Computer chooses move across both of its colors (Blue+Green) within one COMPUTER side turn.
  const forcedCombined = getForcedCombinedMove(state.currentSide);
  if (forcedCombined) {
    // AI one-active-token rule: always resolve with combined total and skip single-die choice.
    state.dice.selectedBall = "sum";
    state.validMoves = getValidMovesForBall(state.currentSide, "sum");
    render();
    return setTimeout(() => aiMoveToken(), 550);
  }
  const choices = getPlayableBalls(state.currentSide);
  if (!choices.length) return endTurn(); // No-valid-move case: end turn immediately.
  const best = pickAiChoice(state.currentSide, choices);
  state.dice.selectedBall = best.ball;
  state.validMoves = getValidMovesForBall(state.currentSide, best.ball);
  render();
  setTimeout(() => aiMoveToken(), 550);
}

function aiMoveToken() {
  if (activeSideType() !== "ai") return;
  if (!state.validMoves.length) return endTurn();
  const choice = pickAiChoice(state.currentSide, [state.dice.selectedBall]);
  if (!choice.move) return endTurn();
  setTimeout(() => doMoveToken(choice.move), 500);
}

function pickAiChoice(side, balls) {
  // AI evaluates both controlled colors each turn and prioritizes capture -> base entry -> progress.
  const scored = [];
  balls.forEach((ball) => {
    const moves = getValidMovesForBall(side, ball);
    moves.forEach((move) => {
      const player = state.players.find((p) => p.color === move.color);
      const token = player.tokens[move.tokenId];
      const value = selectedBallValue(ball);
      const target = getTargetPos(token.pos, value, ball);
      if (target === null) return;
      const score =
        (enemyCaptureCountAtTarget(move.color, target) * 1000) +
        (token.pos === -1 && target === 0 ? 500 : 0) +
        (target === FINAL_HOME ? 300 : 0) +
        (target > token.pos ? target : 0);
      scored.push({ ball, move, score });
    });
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return { ball: best?.ball || balls[0], move: best?.move || null };
}

function enemyCaptureCountAtTarget(movingColor, targetPos) {
  if (targetPos < 0 || targetPos > 51) return 0;
  const abs = (START_INDEX[movingColor] + targetPos) % PATH_LEN;
  let count = 0;
  state.players.forEach((p) => {
    // Allied-color checks are performed here for AI capture scoring.
    if (isSameSide(movingColor, p.color)) return;
    p.tokens.forEach((t) => {
      if (t.pos < 0 || t.pos > 51) return;
      const opos = (START_INDEX[p.color] + t.pos) % PATH_LEN;
      if (opos === abs) count++;
    });
  });
  return count;
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
  el.turnBanner.textContent = state.currentSide === "user" ? "USER Turn (Red + Yellow)" : "COMPUTER Turn (Blue + Green)";
}

function renderBalls() {
  const side = state.currentSide;
  const balls = [...el.ballTray.querySelectorAll(".ball")];
  if (side && state.dice.rolled) recomputeDiceAvailability(side);
  const available = side && state.dice.rolled ? getAvailableBalls() : [];
  const playable = side && state.dice.rolled ? getPlayableBalls(side) : [];

  balls.forEach((b) => {
    const key = b.dataset.ball;
    // Die A / Die B / Sum remain independently usable: disable only when not legally playable,
    // and keep any still-legal remaining die active after one die is consumed.
    b.classList.toggle("disabled", !playable.includes(key));
    b.classList.toggle("selected", state.dice.selectedBall === key);
    const consumed = (key === "a" && state.dice.usedA) || (key === "b" && state.dice.usedB) || (key === "sum" && !state.dice.sumAvailable);
    b.classList.toggle("used", consumed);
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
  const stackGroups = new Map();
  state.players.forEach((p) => {
    p.tokens.forEach((t) => {
      if (t.pos === FINAL_HOME) return;
      if (state.movingToken && state.movingToken.color === p.color && state.movingToken.tokenId === t.id) return;
      const [r, c] = tokenCoord(p.color, t.pos, t.id);
      const key = `${r}:${c}`;
      if (!stackGroups.has(key)) stackGroups.set(key, []);
      stackGroups.get(key).push({ color: p.color, tokenId: t.id, r, c });
    });
  });

  // Token stacking/grouping: multiple tokens share fixed tile bounds using in-tile offsets.
  // Tile size is preserved because tokens are absolutely positioned and never participate in tile layout size.
  const clusterOffsets = [
    [0, 0],
    [-22, -22],
    [22, -22],
    [-22, 22],
    [22, 22]
  ];

  stackGroups.forEach((group) => {
    group.forEach((entry, idx) => {
      const { color, tokenId, r, c } = entry;
      const tok = document.createElement("button");
      tok.className = `token ${color}`;
      // Valid move highlighting spans both colors of the active side after ball selection.
      if (SIDE_BY_COLOR[color] === state.currentSide && state.validMoves.some((m) => m.color === color && m.tokenId === tokenId)) tok.classList.add("valid");
      tok.onclick = () => moveToken(color, tokenId);
      const [offsetX, offsetY] = clusterOffsets[idx] || [0, 0];
      if (group.length > 1) {
        tok.classList.add("stacked");
        tok.style.setProperty("--stack-x", `${offsetX}%`);
        tok.style.setProperty("--stack-y", `${offsetY}%`);
      }
      tile(r, c).appendChild(tok);
    });
  });
}

function recomputeDiceAvailability(side) {
  // DieA / DieB / Sum legal availability is explicitly tracked for UI + turn-flow decisions.
  if (!side || !state.dice.rolled) {
    state.dice.hasLegalA = false;
    state.dice.hasLegalB = false;
    state.dice.hasLegalSum = false;
    state.dice.hasRemainingLegalMove = false;
    return;
  }
  const forcedCombined = getForcedCombinedMove(side);
  if (forcedCombined) {
    // One-active-token rule: individual dice are disabled; only combined-total legality is exposed.
    state.dice.hasLegalA = false;
    state.dice.hasLegalB = false;
    state.dice.hasLegalSum = state.dice.sumAvailable && getValidMovesForBall(side, "sum").length > 0;
    state.dice.hasRemainingLegalMove = state.dice.hasLegalSum;
    return;
  }
  state.dice.hasLegalA = !state.dice.usedA && getValidMovesForBall(side, "a").length > 0;
  state.dice.hasLegalB = !state.dice.usedB && getValidMovesForBall(side, "b").length > 0;
  state.dice.hasLegalSum = state.dice.sumAvailable && getValidMovesForBall(side, "sum").length > 0;
  state.dice.hasRemainingLegalMove = state.dice.hasLegalA || state.dice.hasLegalB || state.dice.hasLegalSum;
}

function getPathCoordsForMove(color, tokenId, startPos, targetPos) {
  if (startPos === -1) return [tokenCoord(color, 0, tokenId)];
  const coords = [];
  for (let pos = startPos + 1; pos <= targetPos; pos++) {
    coords.push(tokenCoord(color, pos, tokenId));
  }
  return coords;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function moveOverlay(node, left, top, duration) {
  node.style.transition = `left ${duration}ms linear, top ${duration}ms linear`;
  node.style.left = `${left}%`;
  node.style.top = `${top}%`;
}

function moveHand(left, top, duration) {
  el.guideHand.style.transition = `left ${duration}ms ease, top ${duration}ms ease, opacity 220ms ease`;
  el.guideHand.style.left = `${left}%`;
  el.guideHand.style.top = `${top}%`;
}

async function animateHandTokenMove(color, tokenId, startPos, targetPos) {
  const pathCoords = getPathCoordsForMove(color, tokenId, startPos, targetPos);
  const startCoord = tokenCoord(color, startPos, tokenId);
  const [startRow, startCol] = startCoord;
  const pickupLeft = ((startCol + 0.5) / 15) * 100;
  const pickupTop = ((startRow + 0.5) / 15) * 100;

  const floating = document.createElement("div");
  floating.className = `token ${color} animating`;
  floating.style.left = `${pickupLeft}%`;
  floating.style.top = `${pickupTop}%`;
  floating.style.transform = "translate(-50%, -50%)";
  el.board.appendChild(floating);

  // Hand enters from outside the board bounds before interacting with any token.
  el.guideHand.classList.remove("fade-out", "hidden", "grab");
  el.guideHand.style.opacity = "1";
  el.guideHand.style.left = "112%";
  el.guideHand.style.top = "108%";
  await wait(40);

  moveHand(pickupLeft, pickupTop, 260);
  await wait(280);

  // Hand picks up token: apply grab state and keep token bound to the hand position.
  el.guideHand.classList.add("grab");
  await wait(120);

  // Hand moves token to destination tile by stepping through the exact counted path.
  for (const [r, c] of pathCoords) {
    const left = ((c + 0.5) / 15) * 100;
    const top = ((r + 0.5) / 15) * 100;
    moveHand(left, top, 180);
    moveOverlay(floating, left, top, 180);
    await wait(200);
  }

  el.guideHand.classList.remove("grab");
  await wait(70);
  floating.remove();

  moveHand(-10, -10, 240);
  el.guideHand.classList.add("fade-out");
  await wait(250);
  el.guideHand.classList.add("hidden");
  el.guideHand.classList.remove("fade-out");
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
  state.dice.sumAvailable = !state.dice.usedA && !state.dice.usedB;
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
  unlockRollSound();
  if (state.mode === "online") {
    if (onlineCanAct()) onlineRoll();
    return;
  }
  if (activeSideType() !== "human") return;
  rollDice();
};

el.ballTray.querySelectorAll(".ball").forEach((b) => {
  b.onclick = () => {
    if (state.mode === "online" && !onlineCanAct()) return;
    if (state.mode !== "online" && activeSideType() !== "human") return;
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

document.addEventListener("pointerdown", unlockRollSound, { once: true });

setupBranding();
verifyDiceSoundPath();
setupBoard();
updateBallValues();
render();
