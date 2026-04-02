# Ludo Classic Backend (Online Multiplayer)

This backend provides realtime room-code multiplayer using Node.js + WebSocket.

## Files

- `backend/server.js`
- `backend/package.json`

## Install dependencies

```bash
cd backend
npm install
```

## Run server

```bash
npm start
```

Default port: `8080`

## Environment variables

- `PORT` (optional): WebSocket server port

Example:

```bash
PORT=9000 npm start
```

## Connect frontend to backend

In `script.js`, frontend uses:

- `window.LUDO_SERVER_URL` if defined
- otherwise fallback: `ws://localhost:8080`

For production, set before loading `script.js` in `index.html` (or via inline script):

```html
<script>
  window.LUDO_SERVER_URL = "wss://YOUR-BACKEND-DOMAIN.com";
</script>
```

## Room code flow

1. Host clicks **Create Room**
2. Backend creates a short 5-character room code
3. Other players click **Join Room** and enter code
4. Host clicks **Start Game**
5. Backend validates turn order, dice, moves, and winner state
6. State is broadcast to all connected room players

## Hosting suggestions

Because many shared cPanel plans do not support long-running Node WebSocket services:

- Host backend on VPS (Ubuntu + Node + PM2 + Nginx)
- or a Node-friendly service (Railway/Render/Fly.io/any VM)
- Use TLS (`wss://`) in production

## cPanel frontend + external backend limitation

If frontend is on cPanel and backend elsewhere:
- You must use the correct `wss://` URL
- Ensure firewall/ports allow WebSocket upgrade
- Some networks/proxies can block WS traffic
- Reconnect logic is basic; disconnected users can rejoin room manually with code
