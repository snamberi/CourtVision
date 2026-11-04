# Update 50 character design

The approved direction combines the athletic proportions of option C with the restrained shading of option B. It is implemented in the procedural renderers, rather than using the generated concept sheet as a game asset.

- Player art uses an 80 × 104 raster inside the existing 40 × 52 display canvas. Smaller heads, a higher waist and longer legs reduce the chunky silhouette. Eyes and hair use simpler color clusters; the existing light/base/shadow palettes keep identity and team colors readable.
- The shared renderer covers real players, generated players, custom player appearances, full-body and portrait views, list icons, cards and share-card exports. Jersey numbers, colors, age variations and deterministic identity choices remain intact.
- User characters compose every existing outfit, hair, hat, glasses, neck/back accessory and shoe before applying the same proportions. Fantasy skin/hair patterns are retained. Auras are generated outside the new silhouette at the same display radius. No saved avatar choices, unlocks or ownership data are migrated.
- Court actions rasterize limbs at half-pixel intervals with tapered calves, forearms and hands, knee highlights and shoe soles. All existing actions, eight views, 16 FPS pose sampling, floor positions and hand anchors remain supported. Ball reaches use the adjusted shoulder height. Shooting sleeves now render on the court, and resting bench portraits receive roster appearance overrides.
- Coaches and referees using the shared figure renderer receive matching proportions. Decorative crowds, pets and non-character icons remain their own art.

## Review

`scripts/preview-characters.ts` renders a contact sheet from the actual code: six player identities at large and small sizes, six custom outfits, eight court directions, six actions and sideline figures. Run the two commands at the top of that script to export an SVG for visual review.

The automated checks cover saved identity stability, imported colors, all avatar catalog pieces, custom fantasy colors and aura separation, all player appearance families, eight court directions, shooting sleeves, every animation sheet, ball reach geometry and viewer controls. Static artwork was inspected; interactive desktop/mobile performance and timing playtesting remains outstanding. The concept image is a style guide, not a pixel-for-pixel promise for every procedural character.

Validation: 75 tests across 13 files passed. TypeScript, production build (including the desktop build) and lint passed with existing warnings. The contact sheet and full-court frames were rendered from the implementation and inspected; six court frames were exported for review. No production merge or deployment was performed.
