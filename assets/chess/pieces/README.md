# Chess Piece Assets

Expected structure for external piece assets:

- `assets/chess/pieces/white/{king,queen,rook,bishop,knight,pawn}.{glb|gltf|obj|png|svg}`
- `assets/chess/pieces/black/{king,queen,rook,bishop,knight,pawn}.{glb|gltf|obj|png|svg}`

Lookup order used by `script.js`:
1. `.glb`
2. `.gltf`
3. `.obj`
4. `.png`
5. `.svg`
6. legacy `assets/pieces/{w|b}-{piece}.svg`
7. internal generated SVG fallback
