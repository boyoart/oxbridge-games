# Word Search Challenge (Oxbridge Tutorial College)

A complete self-hosted HTML5 word search game designed for `public_html/games/word-search/`.

## File structure

```text
word-search/
├─ index.html
├─ style.css
├─ script.js
├─ README.md
├─ embed-code.txt
└─ assets/
   ├─ logo/
   │  └─ logo.png
   └─ sounds/
      ├─ correct.mp3   (optional)
      ├─ wrong.mp3     (optional)
      └─ click.mp3     (optional)
```

## Upload to cPanel

1. Open **cPanel → File Manager**.
2. Go to `public_html/games/`.
3. Create folder `word-search`.
4. Upload all game files into `public_html/games/word-search/`.
5. Ensure this file exists:
   - `public_html/games/word-search/assets/logo/logo.png`
6. Optional sounds can be uploaded to:
   - `public_html/games/word-search/assets/sounds/`

Because all links are relative, the game will work directly at:

`https://YOUR-DOMAIN/games/word-search/`

## Edit the word list

Open `script.js` and update the `WORD_DATA` object near the top.

```js
const WORD_DATA = {
  Countries: [...],
  Science: [...],
  'School Subjects': [...],
  'General Knowledge': [...]
};
```

Tips:
- Add plain words or multi-word entries (spaces are auto-removed in the grid).
- Keep words shorter than the grid size (Easy 10, Medium 12, Hard 14).

## Replace logo

Replace this file with your real logo:

`assets/logo/logo.png`

Note: the repository ships with an empty placeholder `logo.png` so Git stays text-friendly and the game shows the built-in text fallback until you upload the real logo.

The UI includes text fallback (`Oxbridge Tutorial College`) if the image is missing.

## WordPress embed

Use a **Custom HTML** block and paste:

```html
<iframe src="/games/word-search/" style="width:100%;height:85vh;border:0;border-radius:10px;" allowfullscreen></iframe>
```

## Notes

- Optional sounds do not break gameplay if missing.
- Includes difficulty levels, timer, score, found count, fullscreen, and a game-over screen.
- Works on desktop (mouse drag) and mobile (touch swipe).
