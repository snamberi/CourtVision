# Relic artwork

- Added a distinct, full-color pixel illustration for all **59 standard relics** and **8 secret relics**.
- Artwork appears in the collection, daily shop, equipped slots, set previews, single and batch spins, large reveals, career relic case, and secret reward notices.
- Unowned standard relics show dimmed artwork with a lock. Secret relics retain a sealed placeholder until discovered.
- Larger, rarity-framed images match the existing pixel graphics and theme colors. Relic effects, prices, drop rates, progress, and saves are unchanged.
- All artwork ships locally and is included in the web offline cache. Vite supplies the correct paths for web and Windows builds.

## Files

- `src/assets/relics/`: 67 collectible SVG images and one sealed placeholder.
- `src/components/relics/RelicArt.tsx`: shared image component with a fallback.
- `scripts/generate-relic-art.mjs`: editable artwork source. Run `npm run relics:assets` to regenerate. The generator checks that every catalog entry has artwork.

The images use a 48 × 48 pixel grid and scale without blurring. No external image API, download, or new dependency is required.

## Validation

- Full `npm run build`, including TypeScript, web, API, and offline Windows builds.
- All 35 existing relic and relic-mode tests passed.
- Browser checks verified all 67 collection images, the daily shop, 10-spin results, locked states, and secret concealment, with no JavaScript errors or horizontal overflow at desktop and 390 px mobile widths.
- All 68 SVG files (including the sealed placeholder) are valid and distinct. External relic images are included in the generated service-worker cache.
