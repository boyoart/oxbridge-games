# Memory Match (Oxbridge Tutorial College)

A complete self-hosted HTML5 memory card game built with plain HTML, CSS, and JavaScript.

## Project Structure

```text
memory-match/
├── index.html
├── style.css
├── script.js
├── README.md
├── embed-code.txt
└── assets/
    ├── cards/
    ├── logo/
    │   └── logo.png   (upload this manually)
    └── sounds/
```

## Upload to cPanel

1. Open **cPanel → File Manager**.
2. Navigate to: `public_html/games/`
3. Create folder: `memory-match`
4. Upload all files and folders from this project into:
   `public_html/games/memory-match/`
5. Ensure these files are directly inside that folder:
   - `index.html`
   - `style.css`
   - `script.js`

The game will then be available at:

`https://YOURDOMAIN.com/games/memory-match/`

## School Logo Placement

Place the school logo image at:

`assets/logo/logo.png`

The game already uses:

```html
<img src="assets/logo/logo.png" alt="Oxbridge Tutorial College Logo">
```

If the file is missing, the UI automatically shows fallback text:

**Oxbridge Tutorial College**

## WordPress Embed

Use this iframe code in a Custom HTML block:

```html
<iframe src="/games/memory-match/" style="width:100%;height:85vh;border:0;border-radius:10px;" allowfullscreen></iframe>
```

## Change Card Icons/Content

Open `script.js` and edit the `symbols` array near the top.

Example:

```js
const symbols = ["📚", "🔬", "🌍", "✏️", "🏆", "🎵", "🧮", "🚩", "🧠", "📝", "🧪", "📐"];
```

Use emojis, letters, or short symbols.

## Change Board Size and Difficulty

In `script.js`, update the `difficulties` object:

```js
const difficulties = {
  easy: { rows: 4, cols: 4 },
  medium: { rows: 4, cols: 5 },
  hard: { rows: 4, cols: 6 }
};
```

You can also change labels in `index.html` inside the `<select id="difficulty">` options.

## Disable Sounds

### Option 1 (UI)
Use the **Sound** toggle button in-game.

### Option 2 (Default Off)
In `script.js`, set:

```js
let soundOn = false;
```

### Option 3 (Fully Remove Sound)
Delete or comment out the `playTone`/`sounds` logic and related click handlers.

---

Built as a self-hosted, school-friendly educational web game for Oxbridge Tutorial College.
