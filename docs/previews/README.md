# Update 50 character art

These files come from the game's pixel grids, not concept illustrations.

- `update50-player44-native.png`: six transparent 44×44 player tiles, with no resampling.
- `update50-player44-poses.png`: eight poses per row; run, moving dribble, jump shot, dunk, defense. Each 64×64 cell includes the 44px character and transparent padding for raised arms and wide steps.
- `update50-player44.png`: enlarged inspection sheet, including directional views and existing custom outfits.
- `update50-player44.gif`: 16 FPS pose preview. This shows the sprite poses in place; game movement, jump height and basketball motion are applied by the court presentation layer.

Regenerate from the repository root (Node dependencies and Python Pillow required):

```sh
npx rolldown scripts/preview-player44.ts --platform node --file node_modules/.cache/player44.mjs --log-level silent
node node_modules/.cache/player44.mjs node_modules/.cache/player44.json
python3 scripts/preview-player44.py node_modules/.cache/player44.json docs/previews
```

Source artwork is in `src/visuals/pixelPlayer44.ts`; discrete poses and the integer rasterizer are in `src/visuals/actionSprites.ts`. The runtime batches same-color pixel runs into SVG paths with crisp edges. It does not add fractional detail, smoothing filters or a pixelation effect. Saved appearance choices remain the source of player identity.
