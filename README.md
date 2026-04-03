# Flags of the World Quiz (Oxbridge Tutorial College)

A self-hosted HTML5 educational game designed for Oxbridge Tutorial College and ready for cPanel + WordPress embedding.

## Deployment target
Upload all project files to:

```text
public_html/games/flags-world/
```

The game is fully static and uses only **relative paths**, so it runs correctly at:

```text
https://YOURDOMAIN.com/games/flags-world/
```

## Project structure

```text
flags-world/
├─ index.html
├─ style.css
├─ script.js
├─ README.md
├─ embed-code.txt
├─ country-file-list.txt
├─ sound-file-list.txt
└─ assets/
   ├─ flags/            # Upload all country SVG files here
   ├─ logo/
   │  └─ logo.png       # Oxbridge logo file (uploaded later)
   └─ sounds/           # Upload sound effects here
```

## cPanel upload steps
1. Open **cPanel → File Manager**.
2. Navigate to `public_html/games/`.
3. Create folder `flags-world` (if it does not exist).
4. Upload all project files (`index.html`, `style.css`, `script.js`, txt files, and `assets/` folders) into `public_html/games/flags-world/`.
5. Upload all country SVG files into:
   - `public_html/games/flags-world/assets/flags/`
6. Upload the school logo file as:
   - `public_html/games/flags-world/assets/logo/logo.png`
7. Upload sounds into:
   - `public_html/games/flags-world/assets/sounds/`

## Logo behavior
The HTML uses:

```html
<img src="assets/logo/logo.png" alt="Oxbridge Tutorial College Logo">
```

If `logo.png` is missing, the interface automatically shows fallback text:

```text
Oxbridge Tutorial College
```

## Sound files (required names)
Upload the following files to:

```text
public_html/games/flags-world/assets/sounds/
```

- `correct.mp3`
- `wrong.mp3`
- `click.mp3`
- `start.mp3`
- `end.mp3`

If any sound is missing, gameplay still works without crashing.

## Random session logic
- The script stores the full world country dataset as the master pool.
- On each new game, it shuffles the full pool and selects **20 random countries**.
- A country is used only once in that session (no repeats).
- Every question shows 4 options:
  - 1 correct answer
  - 3 random wrong answers from the remaining pool
- Answer order is shuffled each question.

## How to add more countries later
1. Add new country SVG files to `assets/flags/` using slug filenames (for example `new-country.svg`).
2. Add the new slug to the `countrySlugs` list in `script.js`.
3. If needed, add a custom name override in `specialNames` (for special punctuation/hyphenation).
4. Add the filename to `country-file-list.txt`.

## WordPress embed code
Use this iframe in a WordPress Custom HTML block:

```html
<iframe src="/games/flags-world/" style="width:100%;height:85vh;border:0;border-radius:10px;" allowfullscreen></iframe>
```
