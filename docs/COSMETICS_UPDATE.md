# Profile cosmetics update

All main app looks, their palettes, fonts and scene assets are unchanged.

## What changed

- Every picture frame has more detailed artwork: bevelled metal rings, fasteners, hardwood engraving, layered wings, faceted gems, crowns and readable pixel banners. This includes the existing owner-only Sovereign frame.
- Fire, neon and celestial frames have decorative animation. Compact leaderboard portraits use simpler motion; reduced-motion and Lite mode stop the frame effects.
- The picture-frame gallery has a large preview, a leaderboard-size preview and a separate Equip frame button. Locked frames can be inspected at full colour without granting or equipping them.
- Profile icons retain their existing silhouettes and colours, with finer material shading, fabric/leather texture and engraved tile edges. The gallery shows each icon's name alongside its unlock requirement.
- Name-colour tiles include a sample of the current profile name.
- Share-card borders have corner fittings, gems and edge inlays in both landscape and vertical exports.
- Menu phone skins have surface details, screen surrounds and recognisable app icons in their previews.
- Court floors have additional grain, parquet inlays, sand, ice fissures, neon details and starfields. Floor previews and live games use the same material renderer.

## Compatibility

Existing cosmetic IDs, avatar look codes, save keys, unlock conditions, titles, reward lists and progression remain unchanged. Public profiles, reward screens and leaderboards use the shared frame renderer automatically. The owner-only frame stays restricted to the existing owner access rules.

The main app themes and the App look picker were not changed. Fixed cosmetic colours live in their own stylesheet; gallery text and panels use the existing theme variables.

## Validation

- Production build completed, including the offline Windows package.
- 55 focused tests passed across frames, browsing, unlock rules, saved avatar codes, trophy rewards, courts and all app themes.
- Changed cosmetic TypeScript modules passed lint.
- Rendered every frame, icon and court-floor option for visual review, and rendered all share-card styles in landscape and vertical formats.
- Verified every pre-existing main-theme file and look asset against the uploaded ZIP: identical bytes.
- Interactive desktop/mobile browser inspection was unavailable because the cloud browser could not reach the local development server. Gallery behavior was checked with component tests and responsive CSS was reviewed.

## Install

Use this updated CourtVision folder as the source for your usual Git deployment. `npm ci` followed by `npm run build` builds the app. The existing deployment settings are unchanged.
