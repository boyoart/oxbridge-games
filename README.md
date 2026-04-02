# Memory Match (Oxbridge Tutorial College)

A complete self-hosted HTML5 memory game designed for Oxbridge Tutorial College.

## Project structure

```text
memory-match/
├─ index.html
├─ style.css
├─ script.js
├─ README.md
├─ embed-code.txt
└─ assets/
   ├─ cards/
   ├─ logo/
   │  └─ logo.png   (upload this file manually)
   └─ sounds/
```

> Note: The game uses original emoji-based educational card symbols (no copyrighted images required).

## cPanel upload steps

1. In cPanel File Manager, open `public_html/games/`.
2. Create folder: `memory-match`.
3. Upload all files/folders from this project into:
   - `public_html/games/memory-match/`
4. Ensure permissions are standard web-readable (usually 644 files, 755 folders).
5. Visit:
   - `https://YOURDOMAIN.com/games/memory-match/`

## School logo placement

Upload the school logo to:

```text
assets/logo/logo.png
```

The game already uses:

```html
<img src="assets/logo/logo.png" alt="Oxbridge Tutorial College Logo">
```

If `logo.png` is missing, the game automatically shows fallback text:

- `Oxbridge Tutorial College`

## WordPress embed

Use this iframe in a Custom HTML block:

```html
<iframe src="/games/memory-match/" style="width:100%;height:85vh;border:0;border-radius:10px;" allowfullscreen></iframe>
```

## Change card icons/content

Edit `script.js` and update the `symbols` array.

Example:

```js
{ icon: '📚', label: 'Books' }
```

- `icon`: displayed on card back.
- `label`: used to identify matching pairs and accessibility text.

## Change board size and difficulty

Edit `script.js` in the `difficulties` object:

```js
const difficulties = {
  easy: { cols: 4, pairs: 8 },
  medium: { cols: 5, pairs: 10 },
  hard: { cols: 6, pairs: 12 }
};
```

- `cols` controls how many columns are shown.
- `pairs` controls total pairs (total cards = pairs × 2).

## Disable sounds

You can disable sounds in two ways:

1. In-game: click **Sound: On/Off**.
2. Permanently: in `script.js`, set:

```js
let soundEnabled = false;
```

This game uses generated tone effects in JavaScript (no external audio or CDN).
