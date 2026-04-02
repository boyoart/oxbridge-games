# Chess Strategy (Oxbridge Tutorial College)

A complete self-hosted HTML5 chess game built for the Oxbridge Tutorial College games section.

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
   │  └─ logo.png              (upload this file separately)
   └─ pieces/
      ├─ w-pawn.svg
      ├─ w-knight.svg
      ├─ w-bishop.svg
      ├─ w-rook.svg
      ├─ w-queen.svg
      ├─ w-king.svg
      ├─ b-pawn.svg
      ├─ b-knight.svg
      ├─ b-bishop.svg
      ├─ b-rook.svg
      ├─ b-queen.svg
      └─ b-king.svg
```

## cPanel upload steps

1. In cPanel File Manager, open `public_html/games/`.
2. Create (or open) the folder `chess`.
3. Upload all project files and folders so the main page is:
   - `public_html/games/chess/index.html`
4. Confirm file permissions are standard web-readable (typically 644 for files, 755 for folders).

The game will load directly from:

```text
https://YOURDOMAIN.com/games/chess/
```

## School logo placement

Upload the school logo to:

```text
assets/logo/logo.png
```

The game already uses this logo path in HTML. If the file is missing, the interface gracefully shows text fallback:

```text
Oxbridge Tutorial College
```

## WordPress embed

Use the iframe in `embed-code.txt` or copy this directly:

```html
<iframe src="/games/chess/" style="width:100%;height:85vh;border:0;border-radius:10px;" allowfullscreen></iframe>
```

## AI difficulty adjustment

The game includes a front-end AI difficulty selector:

- Easy = search depth 1
- Medium = search depth 2
- Hard = search depth 3

To change defaults in code, edit `script.js`:

- The `<select id="difficulty">` options in `index.html`
- The `chooseAIMove()` depth handling in `script.js`

Higher depth improves play strength but increases CPU usage.

## Swapping chess piece art

1. Replace any SVG file in `assets/pieces/` while keeping the same filename.
2. Keep viewBox sizing consistent so piece scaling remains clean.
3. If you rename files, update `pieceArt` in `script.js`.

## Changing brand colors

Open `style.css` and update the CSS variables in `:root`:

- `--primary-red`
- `--secondary-red`
- `--white`
- `--cream`
- `--text`

These drive the full theme (buttons, header, cards, alerts, and background).

## Notes

- No frameworks, no CDNs, no external libraries.
- Fully self-hosted and offline-capable after upload.
- Uses relative paths only.
