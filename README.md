# Ludo Classic (Oxbridge Tutorial College)

A self-hosted HTML5 Ludo game designed for deployment at:

`public_html/games/ludo/`

It supports:
- Single Player (You vs 3 computer players)
- Local Multiplayer (2 to 4 players)
- Online Multiplayer by room code (with separate Node.js WebSocket backend)

## Project structure

```text
public_html/games/ludo/
├── index.html
├── style.css
├── script.js
├── README.md
├── README-backend.md
├── embed-code.txt
├── sound-file-list.txt
├── backend/
│   ├── package.json
│   └── server.js
└── assets/
    ├── board/
    ├── pieces/
    ├── dice/
    ├── logo/
    │   └── logo.png   (upload this manually)
    └── sounds/
        ├── dice-roll.mp3
        ├── token-move.mp3
        ├── capture.mp3
        ├── win.mp3
        ├── click.mp3
        └── join-room.mp3 (optional)
```

## cPanel upload steps (frontend)

1. Zip the frontend files (`index.html`, `style.css`, `script.js`, `assets/`, and docs).
2. Upload them to `public_html/games/ludo/`.
3. Ensure file paths remain relative and unchanged.
4. Open: `https://YOURDOMAIN.com/games/ludo/`

## School logo placement

Upload your school logo to:

`public_html/games/ludo/assets/logo/logo.png`

The game already references:

```html
<img src="assets/logo/logo.png" alt="Oxbridge Tutorial College Logo">
```

If missing, the UI automatically falls back to text:

`Oxbridge Tutorial College`

## WordPress embed

Use this iframe:

```html
<iframe src="/games/ludo/" style="width:100%;height:85vh;border:0;border-radius:10px;" allowfullscreen></iframe>
```

## Adjusting rules

Open `script.js` and change constants near the top:
- `ENTRY_ROLL` (default 6)
- `HOME_STEPS`
- `SAFE_PATH_INDEX`
- AI strategy in `maybeAITurn()`

## Adjusting board/piece styling

Use `style.css`:
- Board grid and 3D panel: `.board`, `.board-3d`
- Token look: `.token`, `.token.red/.blue/.green/.yellow`
- Dice style/animation: `.dice`, `.dice.rolling`
- Branded buttons: `.brand-btn`

## Disable sounds

- In UI: use the **Sound: On/Off** button.
- In code: set `appState.soundEnabled = false` in `script.js`.

## Required sound file names

The game expects exact names:
- `assets/sounds/dice-roll.mp3`
- `assets/sounds/token-move.mp3`
- `assets/sounds/capture.mp3`
- `assets/sounds/win.mp3`
- `assets/sounds/click.mp3`
- `assets/sounds/join-room.mp3` (optional)

Exact upload folder:

`public_html/games/ludo/assets/sounds/`
