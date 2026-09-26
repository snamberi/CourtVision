# Court Vision — Pixel Art Update

## Visual changes

- Navy and orange pixel interface with crisp panels, hard shadows, pixel navigation icons, readable stat tables, and visible keyboard focus.
- Rebuilt 40 × 52 player sprites with outlined silhouettes, expressive eyes, textured hairstyles, facial hair, skin shading, jersey numbers and trim, arm accessories, socks, and detailed sneakers.
- Existing player ID hashes still select the same skin, hair, beard, and headwear traits. Team colors still update uniforms. No save migration is needed.
- Shared full-body and cropped portraits update player views throughout the game. Artwork is grouped into SVG color paths and memoized.
- New opening-screen court scene, team-selection previews, interactive starting-five display, and player-profile sprite stage.
- Compact navigation on small screens and horizontally scrolling lineup previews.

## Run

Use the existing commands:

```sh
npm ci
npm run dev
```

`npm run build` builds the web app and rebuilds the bundled Windows download. The updated offline package is included at `public/downloads/CourtVision-Windows.zip`.

## Where the changes live

- `src/pixel.css` — shared visual theme, component styles, and responsive layouts.
- `src/visuals/playerSprite.ts` — deterministic layered sprite artwork and color-path batching.
- `src/components/PlayerAvatar.tsx` — shared full-body and portrait renderer.
- `src/components/PixelIcon.tsx` — pixel navigation glyphs and basketball artwork.
- Main menu, sidebar, dashboard, team selection, player profile and editor components — presentation integration.

## Verification

- Web and desktop production builds passed.
- 17 focused tests passed across player sprites, player identity and saves.
- Lint passed for the changed visual modules.
- Browser checks covered new-league creation, team selection, dashboard, profile, editor toggle, roster, player database, and save/reload.
- Desktop and 390px mobile screens were visually inspected; no browser errors were captured and no mobile document overflow was detected.

The existing simulation and persistence modules are unchanged. The full simulation test suite was not rerun for this visual update.
