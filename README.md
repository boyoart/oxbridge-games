# Chess Strategy (Oxbridge Tutorial College)

Chess Strategy is a fully self-hosted, WordPress-embeddable premium digital chess game for `public_html/games/chess/`.

## Project structure

```text
chess/
├─ index.html
├─ style.css
├─ script.js
├─ README.md
├─ embed-code.txt
└─ assets/
   ├─ logo/
   │  ├─ logo.png              (upload school logo)
   │  └─ .gitkeep
   ├─ sounds/
   │  ├─ move.mp3              (optional, move sound)
   │  ├─ capture.mp3           (optional, capture sound)
   │  ├─ click.mp3             (optional, button/click sound)
   │  └─ .gitkeep
   ├─ textures/
   │  └─ .gitkeep
   └─ pieces/
      └─ *.svg                 (legacy pieces retained in repo)
```

## Upload to cPanel

1. Open cPanel File Manager and go to `public_html/games/`.
2. Upload this project folder as `chess`.
3. Confirm `index.html` is at `public_html/games/chess/index.html`.
4. Keep regular permissions (`755` folders, `644` files).

Live URL becomes:

```text
https://YOURDOMAIN.com/games/chess/
```

## Logo setup

Place school logo at:

```text
assets/logo/logo.png
```

The game already renders:

```html
<img src="assets/logo/logo.png" alt="Oxbridge Tutorial College Logo">
```

If missing, fallback text appears automatically:

```text
Oxbridge Tutorial College
```

## Sound setup

Optional local sound files:

- `assets/sounds/move.mp3`
- `assets/sounds/capture.mp3`
- `assets/sounds/click.mp3`

Sound failures are handled gracefully (no crashes if files are absent). Use the in-game **Sound: On/Off** button.

## Timers

- Two independent countdown clocks (player + AI).
- Time control is selected in the intro screen (3:00 / 5:00 / 10:00).
- Only the active side counts down.
- Clock switches automatically after each legal move.
- Timeout ends the game immediately.
- Restart resets both clocks.
- Undo restores previous position **and** previous clock values.

## WordPress embed

Use this iframe in a Custom HTML block:

```html
<iframe src="/games/chess/" style="width:100%;height:85vh;border:0;border-radius:10px;" allowfullscreen></iframe>
```

## Customization

- **Theme colors:** edit CSS variables in `:root` inside `style.css`.
- **Board/piece appearance:** adjust gradients, shadows, and piece SVG generator in `script.js` (`pieceSvg`).
- **Difficulty labels/depth:** edit `<select id="difficulty">` in `index.html` and AI depth usage in `script.js`.
- **Default timer choices:** edit `<select id="timeControl">` in `index.html`.

## Notes

- No CDN dependencies.
- Relative paths only.
- Safe for iframe embedding.
- Fullscreen supported (browser/iframe policy permitting).
