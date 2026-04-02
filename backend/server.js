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
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

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

function createRoom(hostId) {
  let code = roomCode();
  while (rooms.has(code)) code = roomCode();
  const room = {
    code,
    hostId,
    players: [{ socketId: hostId, color: COLORS[0], name: "Player 1", type: "human", tokens: newTokens() }],
    currentTurn: 0,
    diceValue: null,
    mustMove: false,
    winner: null,
    status: "Waiting for players"
  };
  rooms.set(code, room);
  return room;
}

function send(ws, payload) { if (ws.readyState === 1) ws.send(JSON.stringify(payload)); }

function broadcastRoom(room) {
  const state = {
    players: room.players.map(p => ({ ...p, socketId: undefined })),
    currentTurn: room.currentTurn,
    diceValue: room.diceValue,
    mustMove: room.mustMove,
    winner: room.winner,
    status: room.status
  };
  room.players.forEach(p => {
    const ws = sockets.get(p.socketId);
    if (ws) send(ws, { type: "state", state });
  });
}

function canMove(player, tokenId, roll) {
  const t = player.tokens[tokenId];
  if (!t || t.pos === 58) return false;
  if (t.pos === -1) return roll === 6;
  return (t.pos + roll) <= 58;
}

function capture(room, pIdx, tokenId) {
  const p = room.players[pIdx];
  const t = p.tokens[tokenId];
  if (t.pos < 0 || t.pos > 51) return false;
  const abs = (START_INDEX[p.color] + t.pos) % 52;
  if (SAFE.has(abs)) return false;
  let cap = false;
  room.players.forEach((op, i) => {
    if (i === pIdx) return;
    op.tokens.forEach(ot => {
      if (ot.pos < 0 || ot.pos > 51) return;
      const opos = (START_INDEX[op.color] + ot.pos) % 52;
      if (opos === abs) {
        ot.pos = -1;
        cap = true;
      }
    });
  });
  return cap;
}

function winnerIdx(room) { return room.players.findIndex(p => p.tokens.every(t => t.pos === 58)); }

wss.on("connection", (ws) => {
  const socketId = id();
  sockets.set(socketId, ws);
  ws.meta = { socketId, roomCode: null };
  send(ws, { type: "welcome", socketId });

  ws.on("message", raw => {
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
      room.diceValue = null;
      room.mustMove = false;
      room.winner = null;
      room.players.forEach(p => p.tokens = newTokens());
      room.status = "Game started. Player 1 turn.";
      return broadcastRoom(room);
    }

    const pIdx = room.players.findIndex(p => p.socketId === socketId);
    if (pIdx !== room.currentTurn || room.winner !== null) return;

    if (msg.type === "roll-request") {
      if (room.mustMove) return;
      const roll = Math.floor(Math.random() * 6) + 1;
      room.diceValue = roll;
      const moves = room.players[pIdx].tokens.map((_, i) => i).filter(i => canMove(room.players[pIdx], i, roll));
      if (moves.length) {
        room.mustMove = true;
        room.status = `${room.players[pIdx].name} rolled ${roll}. Move a token.`;
      } else {
        room.status = `${room.players[pIdx].name} rolled ${roll}. No valid move.`;
        room.diceValue = null;
        room.mustMove = false;
        if (roll !== 6) room.currentTurn = (room.currentTurn + 1) % room.players.length;
      }
      return broadcastRoom(room);
    }

    if (msg.type === "move") {
      if (!room.mustMove || room.diceValue == null) return;
      const tok = msg.tokenId;
      if (!canMove(room.players[pIdx], tok, room.diceValue)) return;

      const token = room.players[pIdx].tokens[tok];
      token.pos = token.pos === -1 ? 0 : token.pos + room.diceValue;
      capture(room, pIdx, tok);

      const w = winnerIdx(room);
      if (w !== -1) {
        room.winner = w;
        room.status = `${room.players[w].name} wins!`;
      } else {
        const rolled = room.diceValue;
        room.mustMove = false;
        room.diceValue = null;
        if (rolled !== 6) room.currentTurn = (room.currentTurn + 1) % room.players.length;
        room.status = rolled === 6 ? `${room.players[pIdx].name} gets an extra turn.` : `Turn changed.`;
      }
      return broadcastRoom(room);
    }

    if (msg.type === "restart" && room.hostId === socketId) {
      room.players.forEach(p => p.tokens = newTokens());
      room.currentTurn = 0;
      room.diceValue = null;
      room.mustMove = false;
      room.winner = null;
      room.status = "Game restarted.";
      return broadcastRoom(room);
    }
  });

  ws.on("close", () => {
    sockets.delete(socketId);
    const code = ws.meta.roomCode;
    if (!code || !rooms.has(code)) return;
    const room = rooms.get(code);
    room.players = room.players.filter(p => p.socketId !== socketId);
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
