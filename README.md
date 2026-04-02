# Ludo Classic (Oxbridge Tutorial College)

A polished, branded, responsive Ludo game for phone, tablet, laptop, and desktop.

Deploy frontend files into:

`public_html/games/ludo/`

---

## What was updated

- **Classic compact board layout** with four large home quadrants (Red, Blue, Green, Yellow).
- **Centered responsive board scaling** so the board stays square, visible, and focused on mobile + laptop.
- **Center watermark logo** using:
  - `assets/logo/logo.png`
- **Two-dice gameplay house rule**:
  1. Roll 2 dice together.
  2. Move token by the **sum** of both dice.
  3. If **either die is 6**, extra-turn rule applies.
- **Immediate capture + sidebar refresh** so captured tokens reset instantly and counters update right away.
- **Faster computer AI** with simple priority:
  1. Capture if possible
  2. Bring token out if possible
  3. Otherwise move first valid token
- **Full sound events** mapped to required files.

---

## Required sound files

Use these exact files:

- `assets/sounds/dice-roll.mp3`
- `assets/sounds/token-move.mp3`
- `assets/sounds/capture.mp3`
- `assets/sounds/win.mp3`
- `assets/sounds/click.mp3`
- `assets/sounds/join-room.mp3`

Exact upload folder:

`public_html/games/ludo/assets/sounds/`

If any sound file is missing, gameplay still works (no crash).

---

## Logo path

Upload school logo to:

`public_html/games/ludo/assets/logo/logo.png`

Referenced in code as:

`assets/logo/logo.png`

---

## cPanel upload (frontend)

1. Zip the frontend files: `index.html`, `style.css`, `script.js`, `assets/`, and docs.
2. In cPanel, open **File Manager**.
3. Go to `public_html/games/ludo/`.
4. Upload and extract your zip.
5. Confirm paths are unchanged (especially `assets/logo/` and `assets/sounds/`).
6. Open the game at:
   - `https://YOURDOMAIN.com/games/ludo/`

---

## WordPress embed

Use this embed iframe inside a Custom HTML block:

```html
<iframe src="/games/ludo/" style="width:100%;height:85vh;border:0;border-radius:10px;" allowfullscreen></iframe>
```

Tip: If needed, increase height to `90vh` for more board visibility on tablets.

---

## Game modes retained

- Single Player
- Local Multiplayer
- Online Multiplayer (room code)
- Fullscreen mode
- Sound toggle

