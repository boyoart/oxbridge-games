# Flags of the World Quiz

A self-hosted HTML5 quiz game designed for school websites.

## Upload location
Upload this folder to:

```text
public_html/games/flags-world/
```

All files use **relative paths only**, so it works directly from that directory.

## File structure

```text
flags-world/
├─ index.html
├─ style.css
├─ script.js
├─ assets/
│  ├─ flags/
│  │  ├─ argentina.svg
│  │  ├─ australia.svg
│  │  ├─ brazil.svg
│  │  ├─ canada.svg
│  │  ├─ france.svg
│  │  ├─ germany.svg
│  │  ├─ india.svg
│  │  ├─ italy.svg
│  │  ├─ japan.svg
│  │  ├─ mexico.svg
│  │  ├─ nigeria.svg
│  │  ├─ south-korea.svg
│  │  ├─ spain.svg
│  │  ├─ sweden.svg
│  │  ├─ turkey.svg
│  │  └─ usa.svg
│  └─ sounds/
└─ README.md
```

## Features
- Start screen + How to Play
- Start Game button
- Fullscreen button
- Return to Games button (`/games`)
- One flag per question
- 4 randomized answers
- Randomized question order
- Score tracking
- 3 lives system
- 15-second countdown per question
- End screen with replay
- Responsive layout for phones and laptops
- No external libraries/frameworks

## Embedding on a page

```html
<iframe src="/games/flags-world/" style="width:100%;height:85vh;border:0;" allowfullscreen></iframe>
```

## Notes
- Works offline once uploaded.
- You can add more flags by placing more `.svg` files in `assets/flags/` and extending the `flags` array in `script.js`.
