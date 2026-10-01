# Court Vision — visual & customization upgrade

The original pixel style, colors, typography, team identities, and game rules are preserved.

## Artwork

- Refined shared player art: eye colors, brows, expressions, uniform piping, chest patches, fabric folds, and smaller highlights on material edges.
- Seven additional hairstyles: waves, side part, slick back, undercut, curly fade, twists, and box braids. Existing players retain their original skin, hair, beard, and headwear assignments.
- Expanded player skin, hair, and headwear palettes. Custom hex colors remain available.
- The shared artwork updates roster portraits, player cards, profile characters, and animated court players.
- Faceted team emblems and engraved details, stitched crest borders, richer trophy and profile-icon shading, newly drawn navigation icons, and a detailed basketball.
- Court wood grain, subtle paint wear, and additional crowd clothing and face details.

## Your character

Open Player Profile → Your character.

- Large full-body and portrait previews in a locker-style display.
- Visual categories, name search, and unlocked/locked filters.
- Try locked cosmetics on the preview without equipping them. Existing level and Trophy Road unlocks still apply.
- Shuffle the whole look or just the current category; undo the last 20 changes.
- Save and restore three named looks in this browser. Choose Replace to update a slot.
- Cosmetic selections continue to save automatically.

## League players

Open a player's Look editor.

- Visual hair, beard, and headwear galleries with search.
- Eye and brow styles, six eye colors, and four facial expressions.
- Full body, portrait, and on-court previews.
- Palette swatches and custom skin, hair, and headwear colors. Picking a swatch now correctly clears an older custom-color override.
- Randomize, undo, and restore the player's original appearance.

## Run and build

This ZIP contains the full updated project. Install its existing dependencies with `npm ci`, then run `npm run dev`.

`npm run build` checks TypeScript, builds the API, refreshes the offline Windows download, and builds the web version. The deployment configuration is unchanged.

## Validation

- Production build completed successfully, including the offline Windows package.
- 61 targeted tests passed across player rendering, court poses, saved identities, avatar cosmetics, team branding, themes, Trophy Road, and the new customization controls.
- Desktop and 390px mobile layouts inspected in Chromium; no horizontal overflow in either studio.
- Existing build warnings about large chunks and mixed static/dynamic imports remain.
