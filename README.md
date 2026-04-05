# 2048 Puzzle (Oxbridge Tutorial College)

A polished, self-hosted HTML5 **2048 Puzzle** game built for Oxbridge Tutorial College with mobile swipe, desktop keyboard controls, score tracking, win/lose states, and graceful asset fallbacks.

## Deployment target
Upload this game to:

```text
public_html/games/2048/
```

After upload, it should run at:

```text
https://YOURDOMAIN.com/games/2048/
```

All paths in the project are relative so it works in standard cPanel hosting.

## Project structure

```text
2048/
├─ index.html
├─ style.css
├─ script.js
├─ README.md
├─ embed-code.txt
└─ assets/
   ├─ logo/
   │  └─ logo.png
   └─ sounds/
      ├─ move.mp3      (optional)
      ├─ merge.mp3     (optional)
      ├─ click.mp3     (optional)
      ├─ win.mp3       (optional)
      └─ end.mp3       (optional)
```

## cPanel upload steps
1. Open **cPanel → File Manager**.
2. Go to `public_html/games/`.
3. Create folder `2048` if needed.
4. Upload `index.html`, `style.css`, `script.js`, `README.md`, `embed-code.txt`.
5. Upload `assets/logo/logo.png`.
6. Upload any available sound files into `assets/sounds/`.

## Logo path and fallback
The game uses:

```text
assets/logo/logo.png
```

If the logo file is missing, the game automatically shows fallback text:

```text
Oxbridge Tutorial College
```

## Sound path and graceful handling
Optional sounds should be placed in:

```text
assets/sounds/
```

Expected filenames:
- `move.mp3`
- `merge.mp3`
- `click.mp3`
- `win.mp3`
- `end.mp3`

If any are missing, the game continues normally without breaking.

## How to adjust tile colors
Tile colors are defined in `style.css` with selectors like:

```css
.tile[data-val="2"] { ... }
.tile[data-val="4"] { ... }
.tile[data-val="8"] { ... }
...
.tile[data-val="2048"] { ... }
```

Update background/text colors there to match your preferred Oxbridge theme.

## WordPress embed
Use this in a WordPress Custom HTML block:

```html
<iframe src="/games/2048/" style="width:100%;height:85vh;border:0;border-radius:10px;" allowfullscreen></iframe>
```
