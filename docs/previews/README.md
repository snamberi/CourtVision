# Update 50 character art

These files come from the game's pixel grids, not concept illustrations.

- `update50-player64-native.png`: six transparent 64×64 player tiles, with no resampling.
- `update50-player64-curry.png`: one transparent 64×64 tile at its native resolution.
- `update50-player64-poses.png`: eight poses per row; run, moving dribble, jump shot, dunk, defense. Each 96×96 cell includes the 64px character and transparent padding for raised arms and wide steps.
- `update50-player64.png`: enlarged inspection sheet, including directional views and existing custom outfits.
- `update50-player64.gif`: 16 FPS pose preview. This shows the sprite poses in place; game movement, jump height and basketball motion are applied by the court presentation layer.

Regenerate from the repository root (Node dependencies and Python Pillow required):

```sh
npx rolldown scripts/preview-player64.ts --platform node --file node_modules/.cache/player64.mjs --log-level silent
node node_modules/.cache/player64.mjs node_modules/.cache/player64.json
python3 scripts/preview-player64.py node_modules/.cache/player64.json docs/previews
```

Source artwork is in `src/visuals/pixelPlayer64.ts`; discrete poses and the integer rasterizer are in `src/visuals/actionSprites.ts`. The runtime batches same-color pixel runs into SVG paths with crisp edges. It does not add fractional detail, smoothing filters or a pixelation effect. Saved appearance choices remain the source of player identity.

The previous 44px exports are kept for comparison. The 64px artwork is drawn directly with new integer coordinates, 5×7 numbers, single-pixel eye highlights, hair clusters, seams and shoe laces; it is not an enlarged 44px bitmap.
