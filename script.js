// Fixed player turn/color order: Red -> Blue -> Yellow -> Green.
const COLORS = ["red", "blue", "yellow", "green"];
const COLOR_LABEL = { red: "Red", blue: "Blue", yellow: "Yellow", green: "Green" };
const START_INDEX = { red: 0, blue: 13, yellow: 26, green: 39 };
const PATH_LEN = 52;
const AI_MIN_DELAY_MS = 420;
const AI_MAX_DELAY_MS = 900;
const FINAL_HOME_POSITION = 58;
const ENTRY_ROLL = 6;
const HOME_ENTRY_TURN_POS = 48;
const HOME_ENTRY_START_POS = 52;
const BOARD_BASE_SIZE = 720;
const ROLL_ANIMATION_MS = 760;
const ROLL_RESULT_SETTLE_MS = 1080;
const OUTER_TRACK_LAST_POS = HOME_ENTRY_TURN_POS;

const boardEl = document.getElementById("board");
const statusText = document.getElementById("statusText");
const roomCodeLabel = document.getElementById("roomCodeLabel");
const roomCodeValue = document.getElementById("roomCodeValue");
const scoreBoard = document.getElementById("scoreBoard");
const placementsPanelEl = document.getElementById("placementsPanel");
const finalResultsOverlayEl = document.getElementById("finalResultsOverlay");
const finalPlacementsEl = document.getElementById("finalPlacements");
const turnInfo = document.getElementById("turnInfo");
const rollBtn = document.getElementById("rollBtn");
const restartBtn = document.getElementById("restartBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const soundToggleBtn = document.getElementById("soundToggleBtn");
const dice1El = document.getElementById("dice1");
const dice2El = document.getElementById("dice2");
const dieShadow1El = document.getElementById("dieShadow1");
const dieShadow2El = document.getElementById("dieShadow2");
const diceSummaryEl = document.getElementById("diceSummary");
const diceAssignmentEl = document.getElementById("diceAssignment");
const gameSection = document.getElementById("gameSection");
const modeMenu = document.getElementById("modeMenu");
const localConfig = document.getElementById("localConfig");
const localNameFieldsEl = document.getElementById("localNameFields");
const onlineConfig = document.getElementById("onlineConfig");
const connectionStatus = document.getElementById("connectionStatus");
const board3dEl = document.getElementById("board3d");
const boardScalerEl = document.getElementById("boardScaler");
const difficultyInfoEl = document.getElementById("difficultyInfo");
const difficultySelectEl = document.getElementById("difficultySelect");
const baseHolderEls = {
  red: document.getElementById("baseHolder-red"),
  blue: document.getElementById("baseHolder-blue"),
  yellow: document.getElementById("baseHolder-yellow"),
  green: document.getElementById("baseHolder-green")
};
const baseHolderLabelEls = {
  red: document.getElementById("baseHolderLabel-red"),
  blue: document.getElementById("baseHolderLabel-blue"),
  yellow: document.getElementById("baseHolderLabel-yellow"),
  green: document.getElementById("baseHolderLabel-green")
};

function getRequiredEl(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`[Ludo] Missing element: #${id}`);
  return el;
}

const appState = {
  mode: null,
  difficulty: "easy",
  players: [],
  currentTurn: 0,
  dice: { values: [null, null], used: [false, false], rolledSix: false, selectedDie: null, combineMode: false },
  mustMove: false,
  turn: { hasRolled: false, movePending: false, selectedToken: null, diceLocked: false, canRoll: true },
  isRolling: false,
  placements: [],
  gameOver: false,
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
  P.forEach(([r, c]) => {
    const t = getTile(r, c);
    t.classList.add("track");
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
  for (let r = startR; r < startR + 4; r++) {
    for (let c = startC; c < startC + 4; c++) {
      const tile = getTile(r, c);
      tile.classList.add("base-zone", `base-${color}`);
    }
  }
}

function getTile(r, c) {
  return boardCells[r * 15 + c];
}

function newTokens() {
  return Array.from({ length: 4 }, (_, i) => ({
    id: i,
    owner: null,
    pos: -1,
    onBoard: false,
    inHome: false,
    pathIndex: null,
    inBase: true,
    tileKey: null,
    coord: null
  }));
}

function tokenBoardKey(color, localPos) {
  const absolutePathIndex = (START_INDEX[color] + localPos) % PATH_LEN;
  return `track:${absolutePathIndex}`;
}

function tokenHomeKey(color, localPos) {
  return `home:${color}:${localPos - 52}`;
}

function syncTokenStateForPlayer(player) {
  if (!player) return;
  player.tokens.forEach((token) => {
    // DEBUG: authoritative token state is stored/updated here for every token.
    token.pos = normalizeTokenPosForHomeLane(token.pos);
    token.owner = player.color;
    token.inBase = token.pos === -1;
    token.inHome = token.pos === FINAL_HOME_POSITION;
    token.onBoard = token.pos >= 0 && token.pos < FINAL_HOME_POSITION;
    token.pathIndex = token.pos >= 0 && token.pos <= 51 ? token.pos : null;

    if (token.inBase) token.tileKey = `base:${player.color}:${token.id}`;
    else if (token.inHome) token.tileKey = "final-home";
    else if (token.pos >= 52 && token.pos <= 57) token.tileKey = tokenHomeKey(player.color, token.pos);
    else if (token.pathIndex !== null) token.tileKey = tokenBoardKey(player.color, token.pathIndex);
    else token.tileKey = null;

    token.coord = getTokenCoordinates(player.color, token.pos, token.id);
  });
}

function syncAllTokenStates() {
  appState.players.forEach(syncTokenStateForPlayer);
}

function buildTileOccupancy() {
  const occupancy = new Map();
  appState.players.forEach((player, playerIndex) => {
    player.tokens.forEach((token) => {
      if (!token.tileKey || !token.coord) return;
      if (!occupancy.has(token.tileKey)) occupancy.set(token.tileKey, []);
      occupancy.get(token.tileKey).push({ playerIndex, tokenId: token.id, color: player.color });
    });
  });
  return occupancy;
}

function configureGame(mode, localCount = 4) {
  appState.mode = mode;
  appState.currentTurn = 0;
  appState.dice = { values: [null, null], used: [false, false], rolledSix: false, selectedDie: null, combineMode: false };
  appState.mustMove = false;
  appState.turn = { hasRolled: false, movePending: false, selectedToken: null, diceLocked: false, canRoll: true };
  appState.isRolling = false;
  appState.placements = [];
  appState.gameOver = false;
  appState.difficulty = (difficultySelectEl?.value === "hard") ? "hard" : "easy";

  if (mode === "single") {
    appState.players = [
      { type: "human", color: "red", tokens: newTokens(), name: "You", finished: false, place: null },
      { type: "ai", color: "blue", tokens: newTokens(), name: "Computer Blue", finished: false, place: null },
      { type: "ai", color: "yellow", tokens: newTokens(), name: "Computer Yellow", finished: false, place: null },
      { type: "ai", color: "green", tokens: newTokens(), name: "Computer Green", finished: false, place: null }
    ];
  } else if (mode === "local") {
    const configuredNames = getConfiguredLocalNames(localCount);
    appState.players = COLORS.slice(0, localCount).map((c, i) => ({
      type: "human",
      color: c,
      tokens: newTokens(),
      name: configuredNames[i],
      finished: false,
      place: null
    }));
  }
  syncAllTokenStates();

  modeMenu.classList.add("hidden");
  gameSection.classList.remove("hidden");
  finalResultsOverlayEl?.classList.add("hidden");
  roomCodeLabel.classList.toggle("hidden", mode !== "online");
  render();
  updateStatus();
  maybeAITurn();
  requestAnimationFrame(updateBoardScale);
  updateDifficultyInfo();
}

function resetTurnStateForActivePlayer() {
  // DEBUG: stuck-turn reset happens here so the active player can always roll.
  resetDiceDisplay();
  appState.mustMove = false;
  appState.turn.hasRolled = false;
  appState.turn.movePending = false;
  appState.turn.selectedToken = null;
  appState.turn.diceLocked = false;
  appState.turn.canRoll = true;
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
    renderLocalNameFields(Number(document.getElementById("localPlayers")?.value || 4));
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
  const occupancy = buildTileOccupancy();
  // External base holder labels are synced to player names so each color tray is identifiable.
  appState.players.forEach((player) => {
    const labelEl = baseHolderLabelEls[player.color];
    if (labelEl) labelEl.textContent = `${player.name} (${COLOR_LABEL[player.color]})`;
  });

  appState.players.forEach((player, pIndex) => {
    const holderEl = baseHolderEls[player.color];
    player.tokens.forEach((token) => {
      if (token.inBase && holderEl) {
        // Base tokens are rendered in external holders instead of inside board quadrants.
        const baseTokenEl = document.createElement("div");
        baseTokenEl.className = `token ${player.color}`;
        baseTokenEl.title = `${player.name} Token ${token.id + 1}`;
        if (isTokenClickable(pIndex, token.id)) {
          baseTokenEl.classList.add("clickable");
          baseTokenEl.addEventListener("click", () => chooseTokenMove(pIndex, token.id));
        }
        holderEl.appendChild(baseTokenEl);
        return;
      }
      const spot = token.coord;
      if (!spot) return;
      const tile = getTile(spot[0], spot[1]);
      const el = document.createElement("div");
      el.className = `token ${player.color}`;
      el.title = `${player.name} Token ${token.id + 1}`;
      // DEBUG: board render uses token state + occupancy with offsets for stacked tokens.
      const stack = occupancy.get(token.tileKey) || [];
      const stackIndex = stack.findIndex((entry) => entry.playerIndex === pIndex && entry.tokenId === token.id);
      const centeredOnHomeOrBase = token.tileKey?.startsWith("base:") || token.tileKey?.startsWith("home:");
      const stackOffsetX = centeredOnHomeOrBase ? 0 : ((stackIndex % 2) - 0.5) * 24;
      const stackOffsetY = centeredOnHomeOrBase ? 0 : (Math.floor(stackIndex / 2) - 0.5) * 24;
      el.style.transform = `translate(${stackOffsetX}%, ${stackOffsetY}%)`;
      el.style.zIndex = String(3 + Math.max(0, stackIndex));
      if (isTokenClickable(pIndex, token.id)) {
        el.classList.add("clickable");
        el.addEventListener("click", () => chooseTokenMove(pIndex, token.id));
      }
      tile.appendChild(el);
    });
  });

  syncDieFaces();
  const [d1, d2] = appState.dice.values;
  dice1El?.setAttribute("aria-label", `Die 1 showing ${d1 ?? "-"}`);
  dice2El?.setAttribute("aria-label", `Die 2 showing ${d2 ?? "-"}`);
  diceSummaryEl.textContent = `Dice: ${d1 ?? "-"} , ${d2 ?? "-"}`;
  renderDieAssignment();

  const cp = appState.players[appState.currentTurn];
  turnInfo.textContent = cp ? `Turn: ${cp.name} (${COLOR_LABEL[cp.color]})` : "";
  updateDifficultyInfo();

  if (rollBtn) rollBtn.disabled = !canCurrentPlayerRoll();

  // DEBUG: active/home counters are recalculated from authoritative token state only.
  const progress = appState.players.map((p) => ({
    name: p.name,
    color: p.color,
    activeCount: p.tokens.filter((t) => t.onBoard && !t.inHome).length,
    homeCount: p.tokens.filter((t) => t.inHome).length,
    finished: Boolean(p.finished),
    place: p.place
  }));

  scoreBoard.innerHTML = progress.map((p) => `
    <li class="score-item ${p.color}">
      <span class="score-label">${p.name}</span>
      <span class="score-value">${p.finished ? `Finished — ${formatPlaceLabel(p.place)}` : `Active ${p.activeCount}/4 | Home ${p.homeCount}/4`}</span>
    </li>
  `).join("");
  renderPlacementsPanel();
}

function updateDifficultyInfo() {
  if (!difficultyInfoEl) return;
  difficultyInfoEl.textContent = `Difficulty: ${appState.difficulty === "hard" ? "Hard" : "Easy"}`;
}

function getTokenCoordinates(color, pos, tokenId) {
  if (pos === -1) return null;
  if (pos <= 51) return boardPath[(START_INDEX[color] + pos) % PATH_LEN];
  if (pos >= 52 && pos <= 57) return homePaths[color][pos - 52];
  if (pos === FINAL_HOME_POSITION) return [7, 7];
  return null;
}

function normalizeTokenPosForHomeLane(tokenPos) {
  // Prevent legacy/out-of-sequence positions from looping into another full lap.
  if (tokenPos > OUTER_TRACK_LAST_POS && tokenPos <= 51) {
    return HOME_ENTRY_START_POS + (tokenPos - OUTER_TRACK_LAST_POS - 1);
  }
  return tokenPos;
}

// entry rule is centralized here: token leaves base only on a 6.
function canEnterBoard(rollValue) {
  return rollValue === ENTRY_ROLL;
}

// extra-turn rule is centralized here: a turn repeats only on DOUBLE-SIX (6 + 6).
function shouldGrantExtraTurn(rollValues) {
  return Array.isArray(rollValues) && rollValues[0] === ENTRY_ROLL && rollValues[1] === ENTRY_ROLL;
}

function getTargetPosition(tokenPos, rollValue) {
  const normalizedPos = normalizeTokenPosForHomeLane(tokenPos);
  if (normalizedPos === FINAL_HOME_POSITION) return null;
  if (normalizedPos === -1) return canEnterBoard(rollValue) ? 0 : null;
  // home-entry turning logic is checked here.
  if (normalizedPos >= 0 && normalizedPos <= HOME_ENTRY_TURN_POS) {
    // Home-entry turn point is calculated from each token's local track progress.
    const stepsUntilHomeTurn = HOME_ENTRY_TURN_POS - normalizedPos;
    if (rollValue > stepsUntilHomeTurn) {
      // home-entry override is applied here: move into own home lane instead of shared tile.
      const stepsInsideHome = rollValue - (stepsUntilHomeTurn + 1);
      const homeTarget = HOME_ENTRY_START_POS + stepsInsideHome;
      // exact-count-to-home rule still applies while moving inside the home lane.
      return homeTarget <= FINAL_HOME_POSITION ? homeTarget : null;
    }
  }
  const target = normalizedPos + rollValue;
  // exact home rule is enforced here: overshoot beyond final home is illegal.
  if (target > FINAL_HOME_POSITION) return null;
  return target;
}

function canMoveToken(playerIdx, tokenId, rollValue) {
  const token = appState.players[playerIdx]?.tokens[tokenId];
  if (!token) return false;
  return getTargetPosition(token.pos, rollValue) !== null;
}

function getValidMoves(playerIdx, rollValue, includeBase = true) {
  const player = appState.players[playerIdx];
  if (!player) return [];
  return player.tokens.map((_, i) => i).filter((tokenId) => {
    if (!includeBase && player.tokens[tokenId].pos === -1) return false;
    return canMoveToken(playerIdx, tokenId, rollValue);
  });
}

function getTurnMoveOptions(playerIdx) {
  const player = appState.players[playerIdx];
  if (!player) return new Map();
  const options = new Map();
  const activeTokens = player.tokens.map((t, i) => ({ ...t, idx: i })).filter((t) => t.pos >= 0 && t.pos < FINAL_HOME_POSITION);
  const unusedDice = appState.dice.values.map((v, i) => ({ value: v, idx: i })).filter((d) => d.value && !appState.dice.used[d.idx]);

  // one-token total-dice rule is applied here for custom two-dice movement.
  if (activeTokens.length === 1 && unusedDice.length === 2) {
    const onlyToken = activeTokens[0];
    const total = unusedDice[0].value + unusedDice[1].value;
    if (canMoveToken(playerIdx, onlyToken.idx, total)) {
      options.set(onlyToken.idx, [{ type: "combined", value: total }]);
    }
  }
  // entry-from-base rule is checked here for two dice: either die with 6 may launch a token.
  unusedDice.forEach((die) => {
    if (!canEnterBoard(die.value)) return;
    player.tokens.forEach((token, tokenId) => {
      if (token.pos !== -1) return;
      if (!options.has(tokenId)) options.set(tokenId, []);
      options.get(tokenId).push({ type: "single", dieIndex: die.idx, value: die.value });
    });
  });

  // multi-token split-dice rule is applied here for assigning each die separately.
  if (activeTokens.length !== 1 || unusedDice.length < 2) {
    unusedDice.forEach((die) => {
      player.tokens.forEach((_, tokenId) => {
        if (canMoveToken(playerIdx, tokenId, die.value)) {
          if (!options.has(tokenId)) options.set(tokenId, []);
          options.get(tokenId).push({ type: "single", dieIndex: die.idx, value: die.value });
        }
      });
    });
  }
  return options;
}

function isTokenClickable(playerIdx, tokenId) {
  if (!appState.turn.movePending || !appState.mustMove || appState.gameOver) return false;
  const current = appState.players[appState.currentTurn];
  if (!current || current.type !== "human") return false;
  if (appState.mode === "online" && appState.myPlayerIndex !== appState.currentTurn) return false;
  if (playerIdx !== appState.currentTurn) return false;
  return getTurnMoveOptions(playerIdx).has(tokenId);
}

function chooseTokenMove(playerIdx, tokenId) {
  if (!isTokenClickable(playerIdx, tokenId)) return;
  appState.turn.selectedToken = tokenId;
  const options = getTurnMoveOptions(playerIdx).get(tokenId) || [];
  const selected = appState.dice.selectedDie;
  const picked = selected !== null
    ? options.find((o) => o.type === "single" && o.dieIndex === selected)
    : (options.length === 1 ? options[0] : null);
  // die assignment UI logic is handled here by requiring die pick when needed.
  if (!picked) {
    updateStatus("Select one die, then tap a highlighted token.");
    render();
    return;
  }
  if (picked.type === "combined") applyMove(playerIdx, tokenId, picked.value, true, null, true);
  else applyMove(playerIdx, tokenId, picked.value, true, picked.dieIndex, false);
}

// capture rule helper: opponents can be captured anywhere on the normal path.
function canCapture(moverIdx, targetPos) {
  const mover = appState.players[moverIdx];
  if (!mover || targetPos < 0 || targetPos > 51) return false;
  const tileId = tokenBoardKey(mover.color, targetPos);
  return appState.players.some((op, idx) => idx !== moverIdx
    && op.tokens.some((token) => token.tileKey === tileId));
}

function handleCapture(moverIdx, tokenId) {
  const mover = appState.players[moverIdx];
  const moved = mover.tokens[tokenId];
  if (moved.pos < 0 || moved.pos > 51) return false;
  if (moved.pos >= HOME_ENTRY_TURN_POS + 1) {
    // capture is skipped because home-entry takes priority before these shared tiles.
    return false;
  }

  const tileId = tokenBoardKey(mover.color, moved.pos);
  let capturedAny = false;
  appState.players.forEach((op, idx) => {
    if (idx === moverIdx) return; // same-color tokens can never capture each other.
    op.tokens.forEach((t) => {
      if (t.tileKey === tileId) {
        // DEBUG: capture returns token to base; render() then places it back in the external base holder.
        t.pos = -1;
        syncTokenStateForPlayer(op);
        capturedAny = true;
      }
    });
  });

  if (capturedAny) sfx("capture");
  return capturedAny;
}

function applyDifficultyCaptureRule(moverIdx, tokenId, capturedAny) {
  if (!capturedAny) return;
  // DEBUG: difficulty logic branch for capture resolution (Easy vs Hard) is applied here.
  if (appState.difficulty === "easy") {
    const mover = appState.players[moverIdx];
    mover.tokens[tokenId].pos = FINAL_HOME_POSITION;
    syncTokenStateForPlayer(mover);
  }
}

function hasWon(playerIdx) {
  return appState.players[playerIdx].tokens.every((t) => t.pos === FINAL_HOME_POSITION);
}

function advanceTurn(extraTurn) {
  // DEBUG: next active player is selected using the fixed Red->Blue->Yellow->Green order.
  // DEBUG: finished players are skipped in turn order so they never roll/move again.
  if (!appState.players.length) return;
  const currentActive = !appState.players[appState.currentTurn]?.finished;
  const start = (extraTurn && currentActive) ? appState.currentTurn : (appState.currentTurn + 1) % appState.players.length;
  let next = start;
  let guard = 0;
  while (appState.players[next]?.finished && guard < appState.players.length) {
    next = (next + 1) % appState.players.length;
    guard += 1;
  }
  appState.currentTurn = next;
}

function resolveTurnStateAfterAction(playerIdx, options = {}) {
  const {
    extraTurn = false,
    captured = false,
    noValidMove = false,
    rollValues = null
  } = options;
  const player = appState.players[playerIdx];
  if (!player) return;

  // Central stuck-state resolver: all turn flags are finalized here after roll/move assignment.
  const remainingOptions = getTurnMoveOptions(playerIdx);
  const hasMoreAssignments = [...remainingOptions.values()].some((list) => list.length > 0);

  if (hasWon(playerIdx)) {
    assignPlacementForPlayer(playerIdx);
    appState.mustMove = false;
    appState.turn.movePending = false;
    appState.turn.selectedToken = null;
    appState.turn.diceLocked = true;
    appState.turn.canRoll = false;
    const results = maybeCompletePlacements();
    if (results.gameEnded) {
      updateStatus(`Game complete! 1st: ${results.firstName}.`);
      sfx("win");
      render();
      return;
    }
    updateStatus(`${player.name} finished — ${formatPlaceLabel(player.place)}!`);
    // Next unfinished player selection happens here immediately after finishing.
    advanceTurn(false);
    resetTurnStateForActivePlayer();
    render();
    maybeAITurn();
    return;
  }

  if (hasMoreAssignments) {
    appState.mustMove = true;
    appState.turn.movePending = true;
    appState.turn.selectedToken = null;
    appState.turn.diceLocked = true;
    appState.turn.canRoll = false;
    updateStatus(`${player.name} used one die. Use remaining die.`);
    render();
    if (player.type === "ai") runAITurnAssignments();
    return;
  }

  appState.mustMove = false;
  appState.turn.movePending = false;
  appState.turn.selectedToken = null;
  appState.turn.diceLocked = false;
  appState.turn.canRoll = false;
  advanceTurn(extraTurn);
  resetTurnStateForActivePlayer();
  if (noValidMove && rollValues) updateStatus(`${player.name} rolled ${rollValues[0]} and ${rollValues[1]}. No valid move.`);
  else if (captured) updateStatus(`${player.name} captured a token!`);
  else if (extraTurn) updateStatus("Double six! Extra turn.");
  else updateStatus("Turn changed.");
  render();
  maybeAITurn();
}

function resetDiceDisplay() {
  // DEBUG: dice/turn state resets for next roll, including usedDieValues (dice.used).
  appState.dice = { values: [null, null], used: [false, false], rolledSix: false, selectedDie: null, combineMode: false };
}

function syncDieFaces() {
  const updateDie = (dieEl, value, idx) => {
    if (!dieEl) return;
    const face = Math.max(1, Math.min(6, Number(value) || 1));
    dieEl.className = `board-die face-${face}${appState.isRolling ? " rolling" : ""}${appState.dice.used[idx] ? " used" : ""}${appState.dice.selectedDie === idx ? " selected" : ""}`;
    dieEl.dataset.dieIndex = idx;
  };
  updateDie(dice1El, appState.dice.values[0], 0);
  updateDie(dice2El, appState.dice.values[1], 1);
}

function renderDieAssignment() {
  if (!diceAssignmentEl) return;
  const [d1, d2] = appState.dice.values;
  if (!d1 && !d2) {
    diceAssignmentEl.innerHTML = "";
    return;
  }
  diceAssignmentEl.innerHTML = [0, 1].map((i) => `<button class="die-pill ${appState.dice.used[i] ? "used" : ""}" data-die-pill="${i}">Die ${i + 1}: ${appState.dice.values[i] ?? "-"}</button>`).join("");
  diceAssignmentEl.querySelectorAll("[data-die-pill]").forEach((pill) => {
    pill.addEventListener("click", () => selectDieForMove(Number(pill.dataset.diePill)));
  });
}

function selectDieForMove(dieIndex) {
  if (!appState.turn.movePending || appState.dice.used[dieIndex]) return;
  appState.dice.selectedDie = dieIndex;
  render();
}

function applyMove(playerIdx, tokenId, rollValue, allowNetworkEmit = false, dieIndex = null, usedCombined = false) {
  const player = appState.players[playerIdx];
  const token = player.tokens[tokenId];
  const targetPos = getTargetPosition(token.pos, rollValue);

  // every move is validated before state mutation.
  if (targetPos === null) {
    updateStatus("Illegal move.");
    return;
  }

  token.pos = targetPos;
  // DEBUG: order step 1 - update authoritative token state immediately after moving.
  syncTokenStateForPlayer(playerIdx >= 0 ? appState.players[playerIdx] : null);
  // DEBUG: order step 2 - resolve capture immediately on the landing tile.
  const captured = handleCapture(playerIdx, tokenId);
  // DEBUG: capture difficulty branch is applied immediately after capture detection.
  applyDifficultyCaptureRule(playerIdx, tokenId, captured);
  // DEBUG: order step 3 - recalculate all authoritative token states/counters from latest positions.
  syncAllTokenStates();
  sfx("move");
  if (usedCombined) appState.dice.used = [true, true];
  else if (dieIndex !== null) appState.dice.used[dieIndex] = true;
  appState.dice.selectedDie = null;
  // extra-turn rule is applied here: either die showing 6 grants another turn.
  const extraTurn = appState.dice.rolledSix;
  resolveTurnStateAfterAction(playerIdx, { extraTurn, captured });

  if (allowNetworkEmit && appState.mode === "online") {
    sendOnline({ type: "move", tokenId, player: playerIdx, difficulty: appState.difficulty, dieIndex, usedCombined });
  }
}

function rollDicePair() {
  const values = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
  return { values, rolledSix: shouldGrantExtraTurn(values) };
}

function startDiceAnimation() {
  // dice animation starts here (outward tumble from center on roll trigger).
  appState.isRolling = true;
  [dice1El, dice2El].forEach((dieEl, idx) => {
    if (!dieEl) return;
    dieEl.style.setProperty("--roll-x", `${idx === 0 ? -20 : 20}px`);
    dieEl.style.setProperty("--roll-y", `${idx === 0 ? -12 : -14}px`);
    dieEl.style.setProperty("--roll-r", `${idx === 0 ? -18 : 18}deg`);
    dieEl.classList.add("rolling", "roll-out");
  });
  dieShadow1El?.classList.add("rolling");
  dieShadow2El?.classList.add("rolling");
}

function stopDiceAnimation() {
  // dice return-to-center animation happens here after roll result display delay.
  [dice1El, dice2El].forEach((dieEl) => dieEl?.classList.remove("rolling", "roll-out"));
  dieShadow1El?.classList.remove("rolling");
  dieShadow2El?.classList.remove("rolling");
  appState.isRolling = false;
}

function handleNoValidMove(player, rollValues) {
  // DEBUG: no-valid-move turns are resolved via the same centralized state machine.
  syncAllTokenStates();
  resolveTurnStateAfterAction(appState.currentTurn, {
    extraTurn: appState.dice.rolledSix,
    noValidMove: true,
    rollValues
  });
}

function rollDice() {
  if (!canCurrentPlayerRoll()) return;
  if (appState.gameOver) return;
  const p = appState.players[appState.currentTurn];
  if (!p) return;
  if (appState.mode !== "online" && p.type !== "human" && p.type !== "ai") return;

  startDiceAnimation();
  // DEBUG: Roll Dice button is effectively disabled while rolling/awaiting move.
  appState.turn.canRoll = false;
  appState.turn.diceLocked = true;
  render();
  sfx("dice");

  setTimeout(() => {
    const roll = rollDicePair();
    // Final die values are displayed here before movement assignment begins.
    appState.dice = roll;
    appState.dice.used = [false, false];
    appState.dice.selectedDie = null;
    appState.turn.hasRolled = true;
    syncDieFaces();
    render();
    setTimeout(() => {
      stopDiceAnimation();
      const moves = getTurnMoveOptions(appState.currentTurn);
      const moveCount = [...moves.values()].reduce((acc, entries) => acc + entries.length, 0);

      if (!moveCount) {
        handleNoValidMove(p, roll.values);
        return;
      }

      appState.mustMove = true;
      appState.turn.movePending = true;
      updateStatus(`${p.name} rolled ${roll.values[0]} and ${roll.values[1]}. Assign dice to move.`);
      render();

      if (p.type === "ai") runAITurnAssignments();
    }, ROLL_RESULT_SETTLE_MS);
  }, ROLL_ANIMATION_MS);
}

function maybeAITurn() {
  const p = appState.players[appState.currentTurn];
  if (!p || appState.gameOver || p.finished) return;
  if (appState.mode === "online") return;
  if (p.type !== "ai") return;

  statusText.textContent = "Computer thinking...";
  const thinkDelay = AI_MIN_DELAY_MS + Math.floor(Math.random() * (AI_MAX_DELAY_MS - AI_MIN_DELAY_MS + 1));
  setTimeout(() => {
    // Computer dice roll animation starts through the same rollDice flow used by human turns.
    rollDice();
  }, thinkDelay);
}

function pickBestAIMoveOption(playerIndex, options) {
  const currentPlayer = appState.players[playerIndex];
  const expanded = [];
  options.forEach((entryList, tokenId) => {
    entryList.forEach((entry) => expanded.push({ tokenId, ...entry }));
  });
  let pick = expanded.find((m) => {
    const targetPos = getTargetPosition(currentPlayer.tokens[m.tokenId].pos, m.value);
    return targetPos !== null && canCapture(playerIndex, targetPos);
  });
  if (!pick) pick = expanded.find((m) => currentPlayer.tokens[m.tokenId].pos === -1);
  return pick || expanded[0] || null;
}

function runAITurnAssignments() {
  const aiIdx = appState.currentTurn;
  const step = () => {
    const options = getTurnMoveOptions(aiIdx);
    const chosen = pickBestAIMoveOption(aiIdx, options);
    if (!chosen) return;
    if (chosen.type === "combined") applyMove(aiIdx, chosen.tokenId, chosen.value, false, null, true);
    else applyMove(aiIdx, chosen.tokenId, chosen.value, false, chosen.dieIndex, false);
    if (appState.currentTurn === aiIdx && appState.turn.movePending) setTimeout(step, 420);
  };
  setTimeout(step, 420);
}

function canCurrentPlayerRoll() {
  const p = appState.players[appState.currentTurn];
  if (!p || appState.gameOver || p.finished || appState.mustMove || appState.isRolling) return false;
  if (!appState.turn.canRoll || appState.turn.diceLocked || appState.turn.movePending || appState.turn.hasRolled) return false;
  if (appState.mode === "online") return appState.myPlayerIndex === appState.currentTurn;
  return p.type === "human" || p.type === "ai";
}

function updateStatus(message) {
  if (message) {
    statusText.textContent = message;
    return;
  }
  const p = appState.players[appState.currentTurn];
  statusText.textContent = p ? `${p.name}'s turn. Tap center dice to roll.` : "Ready.";
}

function formatPlaceLabel(place) {
  if (place === 1) return "1st Place";
  if (place === 2) return "2nd Place";
  if (place === 3) return "3rd Place";
  return "4th Place";
}

function assignPlacementForPlayer(playerIdx) {
  const player = appState.players[playerIdx];
  if (!player || player.finished) return;
  // DEBUG: placements are assigned in strict finish order.
  player.finished = true;
  player.place = appState.placements.length + 1;
  appState.placements.push({ playerIndex: playerIdx, place: player.place });
}

function maybeCompletePlacements() {
  const unfinished = appState.players
    .map((player, index) => ({ player, index }))
    .filter((entry) => !entry.player.finished);
  // DEBUG: game end condition uses top-3 winners; last unfinished player becomes 4th automatically.
  if (appState.players.length === 4 && appState.placements.length >= 3 && unfinished.length === 1) {
    const last = unfinished[0];
    last.player.finished = true;
    last.player.place = 4;
    appState.placements.push({ playerIndex: last.index, place: 4 });
    appState.gameOver = true;
  }
  if (appState.players.length < 4 && unfinished.length <= 1) {
    if (unfinished.length === 1) {
      const last = unfinished[0];
      last.player.finished = true;
      last.player.place = appState.players.length;
      appState.placements.push({ playerIndex: last.index, place: appState.players.length });
    }
    appState.gameOver = true;
  }
  const firstName = appState.placements.length ? appState.players[appState.placements[0].playerIndex].name : "N/A";
  return { gameEnded: appState.gameOver, firstName };
}

function renderPlacementsPanel() {
  if (!placementsPanelEl) return;
  const byPlace = [...appState.players]
    .filter((p) => Number.isInteger(p.place))
    .sort((a, b) => a.place - b.place);
  const expected = Math.max(appState.players.length, 4);
  placementsPanelEl.innerHTML = Array.from({ length: Math.min(expected, 4) }, (_, i) => {
    const place = i + 1;
    const player = byPlace.find((p) => p.place === place);
    if (!player) return `<div class="placement-card place-${place}"><div class="placement-title">${formatPlaceLabel(place)}</div><div class="placement-subtle">Waiting...</div></div>`;
    return `<div class="placement-card place-${place}"><div class="placement-title">${formatPlaceLabel(place)}</div><div class="placement-player">${player.name} (${COLOR_LABEL[player.color]})</div></div>`;
  }).join("");
  if (finalPlacementsEl && appState.gameOver) {
    finalPlacementsEl.innerHTML = placementsPanelEl.innerHTML;
    finalResultsOverlayEl?.classList.remove("hidden");
  } else {
    finalResultsOverlayEl?.classList.add("hidden");
  }
}

function renderLocalNameFields(localCount) {
  if (!localNameFieldsEl) return;
  const count = Math.min(4, Math.max(2, Number(localCount) || 4));
  localNameFieldsEl.innerHTML = COLORS.slice(0, count).map((color, index) => `
    <input id="playerName${index}" class="player-name-input" type="text" maxlength="20"
      data-player-name-index="${index}" data-player-color="${color}"
      placeholder="${COLOR_LABEL[color]} player name (optional)" value="Player ${index + 1}"
      aria-label="${COLOR_LABEL[color]} player name" />
  `).join("");
}

function getConfiguredLocalNames(localCount) {
  return COLORS.slice(0, localCount).map((_, index) => {
    const rawName = localNameFieldsEl?.querySelector(`[data-player-name-index="${index}"]`)?.value || "";
    const clean = rawName.trim().replace(/\s+/g, " ").slice(0, 20);
    return clean || `Player ${index + 1}`;
  });
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
  appState.players = (state.players || []).map((player) => ({
    ...player,
    finished: Boolean(player.finished),
    place: Number.isInteger(player.place) ? player.place : null,
    tokens: (player.tokens || []).map((token, index) => ({
      id: Number.isInteger(token.id) ? token.id : index,
      owner: player.color,
      pos: Number.isInteger(token.pos) ? token.pos : -1,
      onBoard: false,
      inHome: false,
      pathIndex: null,
      inBase: false,
      tileKey: null,
      coord: null
    }))
  }));
  appState.currentTurn = state.currentTurn;
  appState.difficulty = state.difficulty === "hard" ? "hard" : "easy";

  const syncedValues = Array.isArray(state.diceValues) ? state.diceValues : [null, null];
  appState.dice = {
    values: [syncedValues[0] || null, syncedValues[1] || null],
    used: Array.isArray(state.diceUsed) ? state.diceUsed : [false, false],
    rolledSix: shouldGrantExtraTurn(syncedValues),
    selectedDie: null,
    combineMode: false
  };

  appState.mustMove = state.mustMove;
  appState.turn = {
    hasRolled: appState.dice.values.some(Boolean),
    movePending: Boolean(state.mustMove),
    selectedToken: null,
    diceLocked: Boolean(state.mustMove),
    canRoll: !state.mustMove && !appState.dice.values.some(Boolean)
  };
  appState.isRolling = false;
  appState.placements = Array.isArray(state.placements) ? state.placements : [];
  appState.gameOver = Boolean(state.gameOver);
  appState.myPlayerIndex = Number.isInteger(state.myPlayerIndex) ? state.myPlayerIndex : appState.myPlayerIndex;
  syncAllTokenStates();
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

  difficultySelectEl?.addEventListener("change", () => {
    appState.difficulty = difficultySelectEl.value === "hard" ? "hard" : "easy";
    updateDifficultyInfo();
  });

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
  localPlayersSelect?.addEventListener("change", () => {
    renderLocalNameFields(Number(localPlayersSelect.value || 4));
  });

  createRoomBtn?.addEventListener("click", () => sendOnline({ type: "create-room" }));
  joinRoomBtn?.addEventListener("click", () => {
    const code = roomCodeInput?.value.trim().toUpperCase() || "";
    if (!code) return;
    appState.roomCode = code;
    sendOnline({ type: "join-room", roomCode: code });
  });
  startOnlineBtn?.addEventListener("click", () => sendOnline({
    type: "start-game",
    difficulty: difficultySelectEl?.value === "hard" ? "hard" : "easy"
  }));

  rollBtn?.addEventListener("click", () => {
    if (appState.mode === "online") sendOnline({ type: "roll-request" });
    else rollDice();
  });
  // center dice click/tap triggers roll and die assignment interactions.
  [dice1El, dice2El].forEach((dieEl) => {
    dieEl?.addEventListener("click", () => {
      const dieIndex = Number(dieEl.dataset.dieIndex || 0);
      if (appState.turn.movePending) selectDieForMove(dieIndex);
      else if (appState.mode === "online") sendOnline({ type: "roll-request" });
      else rollDice();
    });
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
renderLocalNameFields(4);
bindUI();
updateBoardScale();
updateStatus("Choose a mode, then press Start Game.");
render();
