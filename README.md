# Oxbridge Chess (Stable 2D Reset)

This project has been reset to a clean, stable 2D chess frontend.

## Included now

- Board-state driven chess engine
- Click-to-move controls
- Legal move highlighting
- Turn switching, check/checkmate/stalemate detection
- Undo and restart
- Local mode and Player vs Computer mode
- Responsive premium framed board styling
- School logo integrated in dark squares
- Fullscreen button

## Architecture notes

- The board state in `script.js` is the source of truth.
- Move generation is split into pseudo-legal move generation + check safety filtering.
- A future 3D plug-in placeholder exists (`pieceAssetMap`, `loadPieceAsset`, `renderPiece`) but no GLB/FBX loading is active.

## Run

Open `index.html` directly or deploy folder as static files.
