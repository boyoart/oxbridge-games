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
const COLORS = ["red", "blue", "green", "yellow"];
const START_INDEX = { red: 0, blue: 13, yellow: 26, green: 39 };
const PATH_LEN = 52;
const FINAL_HOME_POSITION = 58;
const ENTRY_ROLL = 6;

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

// entry rule is centralized: token can leave base only on 6.
function canEnterBoard(roll) {
  return roll === ENTRY_ROLL;
}

// extra-turn rule is centralized: only 6 grants another turn.
function shouldGrantExtraTurn(roll) {
  return roll === ENTRY_ROLL;
}

function getTargetPosition(tokenPos, roll) {
  if (tokenPos === FINAL_HOME_POSITION) return null;
  if (tokenPos === -1) return canEnterBoard(roll) ? 0 : null;
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

  if (activeTokens.length === 1 && unusedDice.length === 2) {
    const total = unusedDice[0].value + unusedDice[1].value;
    if (canMoveToken(player, activeTokens[0].idx, total)) options.set(activeTokens[0].idx, [{ type: "combined", value: total }]);
  }
  unusedDice.forEach((die) => {
    if (!canEnterBoard(die.value)) return;
    player.tokens.forEach((token, tokenId) => {
      if (token.pos !== -1) return;
      if (!options.has(tokenId)) options.set(tokenId, []);
      options.get(tokenId).push({ type: "single", dieIndex: die.idx, value: die.value });
    });
  });
  if (activeTokens.length !== 1 || unusedDice.length < 2) {
    unusedDice.forEach((die) => {
      player.tokens.forEach((_, tokenId) => {
        if (!canMoveToken(player, tokenId, die.value)) return;
        if (!options.has(tokenId)) options.set(tokenId, []);
        options.get(tokenId).push({ type: "single", dieIndex: die.idx, value: die.value });
      });
    });
  }
  return options;
}

function canCapture(room, moverIdx, targetPos) {
  const mover = room.players[moverIdx];
  if (!mover || targetPos < 0 || targetPos > 51) return false;
  const abs = (START_INDEX[mover.color] + targetPos) % PATH_LEN;

  return room.players.some((op, idx) => idx !== moverIdx
    && op.tokens.some((token) => token.pos >= 0 && token.pos <= 51
      && ((START_INDEX[op.color] + token.pos) % PATH_LEN) === abs));
}

function capture(room, pIdx, tokenId) {
  const p = room.players[pIdx];
  const t = p.tokens[tokenId];
  if (t.pos < 0 || t.pos > 51) return false;
  const abs = (START_INDEX[p.color] + t.pos) % PATH_LEN;

  let cap = false;
  room.players.forEach((op, i) => {
    if (i === pIdx) return; // same-color tokens cannot capture each other.
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
  // turn switching happens here and respects extra-turn rule.
  if (!extraTurn) room.currentTurn = (room.currentTurn + 1) % room.players.length;
}

function createRoom(hostId) {
  let code = roomCode();
  while (rooms.has(code)) code = roomCode();
  const room = {
    code,
    hostId,
    players: [{ socketId: hostId, color: COLORS[0], name: "Player 1", type: "human", tokens: newTokens() }],
    currentTurn: 0,
    diceValues: [null, null],
    diceUsed: [false, false],
    mustMove: false,
    winner: null,
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
    winner: room.winner,
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
      if (room.winner !== null) return send(ws, { type: "error", message: "Game already finished." });

      const color = COLORS[room.players.length];
      room.players.push({ socketId, color, name: `Player ${room.players.length + 1}`, type: "human", tokens: newTokens() });
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
      room.winner = null;
      room.difficulty = msg.difficulty === "hard" ? "hard" : "easy";
      room.players.forEach((p) => { p.tokens = newTokens(); });
      room.status = `Game started (${room.difficulty === "hard" ? "Hard" : "Easy"}). Player 1 turn.`;
      return broadcastRoom(room);
    }

    const pIdx = room.players.findIndex((p) => p.socketId === socketId);
    if (pIdx !== room.currentTurn || room.winner !== null) return;

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
        room.status = `${room.players[pIdx].name} rolled ${roll[0]} and ${roll[1]}. No valid move.`;
        room.diceValues = [null, null];
        room.diceUsed = [false, false];
        room.mustMove = false;
        advanceTurn(room, roll.some((v) => shouldGrantExtraTurn(v)));
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
        room.winner = pIdx;
        room.status = `${room.players[pIdx].name} wins!`;
      } else {
        const remaining = getTurnMoveOptions(room, pIdx);
        const hasMoreAssignments = [...remaining.values()].some((list) => list.length > 0);
        if (hasMoreAssignments) {
          room.mustMove = true;
          room.status = `${room.players[pIdx].name} used one die. Use remaining die.`;
        } else {
          const extra = room.diceValues.some((v) => shouldGrantExtraTurn(v));
          room.mustMove = false;
          room.diceValues = [null, null];
          room.diceUsed = [false, false];
          advanceTurn(room, extra);
          if (didCapture) room.status = `${room.players[pIdx].name} captured a token!`;
          else if (extra) room.status = `${room.players[pIdx].name} gets an extra turn.`;
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
      room.winner = null;
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
