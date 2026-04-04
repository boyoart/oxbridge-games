/*
  Ludo Classic WebSocket backend
  - Room code create/join
  - Host start game
  - Authoritative turn + dice + move validation
*/
const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT || 8080);
const rooms = new Map();
const sockets = new Map();
// Fixed player turn/color order: Red -> Blue -> Yellow -> Green.
const COLORS = ["red", "blue", "yellow", "green"];
// Team ownership is fixed and distinct from turn order ownership.
const TEAM_BY_COLOR = { red: "user", yellow: "user", blue: "computer", green: "computer" };
const START_INDEX = { red: 0, blue: 13, yellow: 26, green: 39 };
const PATH_LEN = 52;
const FINAL_HOME_POSITION = 58;
const ENTRY_ROLL = 6;
const HOME_ENTRY_TURN_POS = 48;
const HOME_ENTRY_START_POS = 52;

const server = http.createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Ludo Classic realtime server is running.\n");
});
const wss = new WebSocketServer({ server });

function id() { return Math.random().toString(36).slice(2, 10); }
function roomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function newTokens() { return Array.from({ length: 4 }, (_, i) => ({ id: i, pos: -1 })); }
function isSameTeam(colorA, colorB) { return TEAM_BY_COLOR[colorA] === TEAM_BY_COLOR[colorB]; }

// entry rule is centralized: token can leave base only on 6.
function canEnterBoard(roll) {
  return roll === ENTRY_ROLL;
}

// extra-turn rule is centralized: only DOUBLE-SIX (6 + 6) grants another turn.
function shouldGrantExtraTurn(rolls) {
  return Array.isArray(rolls) && rolls[0] === ENTRY_ROLL && rolls[1] === ENTRY_ROLL;
}

function getTargetPosition(tokenPos, roll) {
  if (tokenPos === FINAL_HOME_POSITION) return null;
  if (tokenPos === -1) return canEnterBoard(roll) ? 0 : null;
  // home-entry turning logic is checked here.
  if (tokenPos >= 0 && tokenPos <= HOME_ENTRY_TURN_POS) {
    const stepsUntilHomeTurn = HOME_ENTRY_TURN_POS - tokenPos;
    if (roll > stepsUntilHomeTurn) {
      // home-entry override is applied here (skip shared-tile capture opportunity).
      const stepsInsideHome = roll - (stepsUntilHomeTurn + 1);
      const homeTarget = HOME_ENTRY_START_POS + stepsInsideHome;
      return homeTarget <= FINAL_HOME_POSITION ? homeTarget : null;
    }
  }
  const target = tokenPos + roll;
  // exact home rule: cannot overshoot final home.
  if (target > FINAL_HOME_POSITION) return null;
  return target;
}

function canMoveToken(player, tokenId, roll) {
  const t = player.tokens[tokenId];
  if (!t) return false;
  return getTargetPosition(t.pos, roll) !== null;
}

function getValidMoves(player, roll) {
  return player.tokens.map((_, i) => i).filter((tokenId) => canMoveToken(player, tokenId, roll));
}

function getTurnMoveOptions(room, playerIdx) {
  const player = room.players[playerIdx];
  const options = new Map();
  const activeTokens = player.tokens.map((t, idx) => ({ ...t, idx })).filter((t) => t.pos >= 0 && t.pos < FINAL_HOME_POSITION);
  const unusedDice = room.diceValues.map((v, i) => ({ value: v, idx: i })).filter((d) => d.value && !room.diceUsed[d.idx]);

  // Ball 3 (sum) stays independently usable while both dice are unused.
  // This preserves 3-ball behavior: Die A, Die B, and Sum all remain valid options when legal.
  if (unusedDice.length === 2) {
    const total = unusedDice[0].value + unusedDice[1].value;
    activeTokens.forEach((token) => {
      if (!canMoveToken(player, token.idx, total)) return;
      if (!options.has(token.idx)) options.set(token.idx, []);
      options.get(token.idx).push({ type: "combined", value: total });
    });
  }

  // Base entry on 6 is checked per die, even when another token of the same color is already active.
  unusedDice.forEach((die) => {
    if (!canEnterBoard(die.value)) return;
    player.tokens.forEach((token, tokenId) => {
      if (token.pos !== -1) return;
      if (!options.has(tokenId)) options.set(tokenId, []);
      options.get(tokenId).push({ type: "single", dieIndex: die.idx, value: die.value });
    });
  });

  // Die A and Die B remain independently usable, so regular single-die movement is always considered.
  unusedDice.forEach((die) => {
    player.tokens.forEach((_, tokenId) => {
      if (!canMoveToken(player, tokenId, die.value)) return;
      if (!options.has(tokenId)) options.set(tokenId, []);
      options.get(tokenId).push({ type: "single", dieIndex: die.idx, value: die.value });
    });
  });
  return options;
}

function canCapture(room, moverIdx, targetPos) {
  const mover = room.players[moverIdx];
  if (!mover || targetPos < 0 || targetPos > 51) return false;
  const abs = (START_INDEX[mover.color] + targetPos) % PATH_LEN;

  return room.players.some((op, idx) => idx !== moverIdx
    // Allied capture is blocked: only opposing teams are capturable.
    && !isSameTeam(mover.color, op.color)
    && op.tokens.some((token) => token.pos >= 0 && token.pos <= 51
      && ((START_INDEX[op.color] + token.pos) % PATH_LEN) === abs));
}

function capture(room, pIdx, tokenId) {
  const p = room.players[pIdx];
  const t = p.tokens[tokenId];
  if (t.pos < 0 || t.pos > 51) return false;
  if (t.pos >= HOME_ENTRY_TURN_POS + 1) {
    // capture is skipped because home-entry takes priority before this path segment.
    return false;
  }
  const abs = (START_INDEX[p.color] + t.pos) % PATH_LEN;

  let cap = false;
  room.players.forEach((op, i) => {
    if (i === pIdx) return; // same-color tokens cannot capture each other.
    // Allied capture is blocked for cross-color allies (Red/Yellow and Blue/Green).
    if (isSameTeam(p.color, op.color)) return;
    op.tokens.forEach((ot) => {
      if (ot.pos < 0 || ot.pos > 51) return;
      const opos = (START_INDEX[op.color] + ot.pos) % PATH_LEN;
      if (opos === abs) {
        // capture rule enforced: opponent token returns to base immediately.
        ot.pos = -1;
        cap = true;
      }
    });
  });
  return cap;
}

function hasWon(room, playerIdx) {
  return room.players[playerIdx].tokens.every((t) => t.pos === FINAL_HOME_POSITION);
}

function advanceTurn(room, extraTurn) {
  // next active player is selected using fixed Red->Blue->Yellow->Green order.
  // finished players are skipped in turn order so they cannot roll or move.
  const currentActive = !room.players[room.currentTurn]?.finished;
  const start = (extraTurn && currentActive) ? room.currentTurn : (room.currentTurn + 1) % room.players.length;
  let next = start;
  let guard = 0;
  while (room.players[next]?.finished && guard < room.players.length) {
    next = (next + 1) % room.players.length;
    guard += 1;
  }
  room.currentTurn = next;
}

function assignPlacement(room, playerIdx) {
  const player = room.players[playerIdx];
  if (!player || player.finished) return;
  // placements are assigned in exact order that players finish all 4 tokens.
  player.finished = true;
  player.place = room.placements.length + 1;
  room.placements.push({ playerIndex: playerIdx, place: player.place });
}

function maybeCompleteGame(room) {
  const unfinished = room.players
    .map((player, index) => ({ player, index }))
    .filter((entry) => !entry.player.finished);
  // game end condition for 3 winners: assign last remaining player as 4th and stop.
  if (room.players.length === 4 && room.placements.length >= 3 && unfinished.length === 1) {
    const last = unfinished[0];
    last.player.finished = true;
    last.player.place = 4;
    room.placements.push({ playerIndex: last.index, place: 4 });
    room.gameOver = true;
  } else if (room.players.length < 4 && unfinished.length <= 1) {
    if (unfinished.length === 1) {
      const last = unfinished[0];
      last.player.finished = true;
      last.player.place = room.players.length;
      room.placements.push({ playerIndex: last.index, place: room.players.length });
    }
    room.gameOver = true;
  }
}

function createRoom(hostId) {
  let code = roomCode();
  while (rooms.has(code)) code = roomCode();
  const room = {
    code,
    hostId,
    players: [{ socketId: hostId, color: COLORS[0], name: "Player 1", type: "human", tokens: newTokens(), finished: false, place: null }],
    currentTurn: 0,
    diceValues: [null, null],
    diceUsed: [false, false],
    mustMove: false,
    placements: [],
    gameOver: false,
    status: "Waiting for players",
    difficulty: "easy"
  };
  rooms.set(code, room);
  return room;
}

function send(ws, payload) { if (ws.readyState === 1) ws.send(JSON.stringify(payload)); }

function broadcastRoom(room) {
  const state = {
    players: room.players.map((p) => ({ ...p, socketId: undefined })),
    currentTurn: room.currentTurn,
    diceValues: room.diceValues,
    diceUsed: room.diceUsed,
    mustMove: room.mustMove,
    placements: room.placements,
    gameOver: room.gameOver,
    status: room.status,
    difficulty: room.difficulty
  };
  room.players.forEach((p) => {
    const ws = sockets.get(p.socketId);
    if (!ws) return;
    const myPlayerIndex = room.players.findIndex((rp) => rp.socketId === p.socketId);
    send(ws, { type: "state", state: { ...state, myPlayerIndex } });
  });
}

wss.on("connection", (ws) => {
  const socketId = id();
  sockets.set(socketId, ws);
  ws.meta = { socketId, roomCode: null };
  send(ws, { type: "welcome", socketId });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "create-room") {
      const room = createRoom(socketId);
      ws.meta.roomCode = room.code;
      send(ws, { type: "room-created", roomCode: room.code });
      return broadcastRoom(room);
    }

    if (msg.type === "join-room") {
      const room = rooms.get(msg.roomCode);
      if (!room) return send(ws, { type: "error", message: "Room not found." });
      if (room.players.length >= 4) return send(ws, { type: "error", message: "Room is full." });
      if (room.gameOver) return send(ws, { type: "error", message: "Game already finished." });

      const color = COLORS[room.players.length];
      room.players.push({ socketId, color, name: `Player ${room.players.length + 1}`, type: "human", tokens: newTokens(), finished: false, place: null });
      ws.meta.roomCode = room.code;
      send(ws, { type: "room-joined", roomCode: room.code });
      room.status = "Player joined. Host can start game.";
      broadcastRoom(room);
      return;
    }

    const room = rooms.get(msg.roomCode || ws.meta.roomCode);
    if (!room) return;

    if (msg.type === "start-game") {
      if (room.hostId !== socketId) return;
      if (room.players.length < 2) return send(ws, { type: "error", message: "Need at least 2 players." });
      room.currentTurn = 0;
      room.diceValues = [null, null];
      room.diceUsed = [false, false];
      room.mustMove = false;
      room.placements = [];
      room.gameOver = false;
      room.difficulty = msg.difficulty === "hard" ? "hard" : "easy";
      room.players.forEach((p) => {
        p.tokens = newTokens();
        p.finished = false;
        p.place = null;
      });
      room.status = `Game started (${room.difficulty === "hard" ? "Hard" : "Easy"}). Player 1 turn.`;
      return broadcastRoom(room);
    }

    const pIdx = room.players.findIndex((p) => p.socketId === socketId);
    if (pIdx !== room.currentTurn || room.gameOver || room.players[pIdx]?.finished) return;

    if (msg.type === "roll-request") {
      if (room.mustMove) return;
      const roll = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
      room.diceValues = roll;
      room.diceUsed = [false, false];
      const options = getTurnMoveOptions(room, pIdx);
      const moveCount = [...options.values()].reduce((sum, list) => sum + list.length, 0);
      if (moveCount) {
        room.mustMove = true;
        room.status = `${room.players[pIdx].name} rolled ${roll[0]} and ${roll[1]}. Assign dice.`;
      } else {
        // stuck-turn reset happens here when no legal assignment exists after rolling.
        room.status = `${room.players[pIdx].name} rolled ${roll[0]} and ${roll[1]}. No valid move.`;
        room.diceValues = [null, null];
        room.diceUsed = [false, false];
        room.mustMove = false;
        advanceTurn(room, shouldGrantExtraTurn(roll));
      }
      return broadcastRoom(room);
    }

    if (msg.type === "move") {
      if (!room.mustMove) return;
      const tok = msg.tokenId;
      const token = room.players[pIdx].tokens[tok];
      const options = getTurnMoveOptions(room, pIdx).get(tok) || [];
      const selected = msg.usedCombined
        ? options.find((o) => o.type === "combined")
        : options.find((o) => o.type === "single" && o.dieIndex === msg.dieIndex);
      if (!selected) return;
      const targetPos = getTargetPosition(token.pos, selected.value);
      if (targetPos === null) return;

      token.pos = targetPos;
      const didCapture = canCapture(room, pIdx, targetPos);
      if (didCapture) capture(room, pIdx, tok);
      // difficulty branch for capture: easy sends the capturing token directly home.
      if (didCapture && room.difficulty === "easy") {
        token.pos = FINAL_HOME_POSITION;
      }
      if (msg.usedCombined) room.diceUsed = [true, true];
      else if (Number.isInteger(msg.dieIndex)) room.diceUsed[msg.dieIndex] = true;

      if (hasWon(room, pIdx)) {
        // finished players are detected and assigned placement as soon as all tokens are home.
        assignPlacement(room, pIdx);
        room.mustMove = false;
        room.diceValues = [null, null];
        room.diceUsed = [false, false];
        maybeCompleteGame(room);
        if (room.gameOver) room.status = "Game complete. Final rankings are ready.";
        else {
          room.status = `${room.players[pIdx].name} finished — ${room.players[pIdx].place}${room.players[pIdx].place === 1 ? "st" : room.players[pIdx].place === 2 ? "nd" : "rd"} place.`;
          advanceTurn(room, false);
        }
      } else {
        const remaining = getTurnMoveOptions(room, pIdx);
        const hasMoreAssignments = [...remaining.values()].some((list) => list.length > 0);
        if (hasMoreAssignments) {
          room.mustMove = true;
          room.status = `${room.players[pIdx].name} used one die. Use remaining die.`;
        } else {
          const extra = shouldGrantExtraTurn(room.diceValues);
          // dice/turn state resets for next roll.
          room.mustMove = false;
          room.diceValues = [null, null];
          room.diceUsed = [false, false];
          advanceTurn(room, extra);
          if (didCapture) room.status = `${room.players[pIdx].name} captured a token!`;
          else if (extra) room.status = `${room.players[pIdx].name} rolled double six and gets an extra turn.`;
          else room.status = "Turn changed.";
        }
      }
      return broadcastRoom(room);
    }

    if (msg.type === "restart" && room.hostId === socketId) {
      room.players.forEach((p) => { p.tokens = newTokens(); });
      room.currentTurn = 0;
      room.diceValues = [null, null];
      room.diceUsed = [false, false];
      room.mustMove = false;
      room.placements = [];
      room.gameOver = false;
      room.players.forEach((p) => {
        p.finished = false;
        p.place = null;
      });
      room.status = `Game restarted (${room.difficulty === "hard" ? "Hard" : "Easy"}).`;
      return broadcastRoom(room);
    }
  });

  ws.on("close", () => {
    sockets.delete(socketId);
    const code = ws.meta.roomCode;
    if (!code || !rooms.has(code)) return;
    const room = rooms.get(code);
    room.players = room.players.filter((p) => p.socketId !== socketId);
    if (!room.players.length) return rooms.delete(code);
    if (room.hostId === socketId) room.hostId = room.players[0].socketId;
    if (room.currentTurn >= room.players.length) room.currentTurn = 0;
    room.status = "A player disconnected.";
    broadcastRoom(room);
  });
});

server.listen(PORT, () => {
  console.log(`Ludo realtime server listening on :${PORT}`);
});
