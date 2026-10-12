# Mode icons and animation update

## What changed

- Six detailed pixel emblems for Franchise, League Hunt, 82-0 Challenge, Career, Survival and Story, with matching arena banners.
- Coordinated icons for franchise challenges, real/random leagues, World Games, Hunt tabs and starting decks, Legend Challenges, all 82-0 variants and What If modes, Draft Battle rivals, Career builders, Survival runs and Story playstyles.
- The same artwork now appears on Quick Games cards, arcade navigation, daily/endless switches and the phone's existing Play/Compete sheets.
- Subtle glow and sparkle loops, floating banner emblems, and extra motion on hover, keyboard focus or selection: spinning wheels, ticking clocks, bouncing details and shield/scoreboard flames.
- Existing theme colors, gameplay, unlocks, saves and navigation remain in place. Locked choices retain their disabled behavior.
- Reduced-motion preferences and Lite graphics disable decorative animation. Icons are hidden from screen readers so existing button labels remain clear.

## Implementation

`src/components/ModeIcon.tsx` defines the shared 64×64 SVG emblems and their mode-to-art mapping. `src/components/modeIcons.css` owns their scoped layout and motion. `ModeCard.tsx` uses the same artwork in its panoramic banners. Artwork uses local SVG paths with no new runtime dependencies or downloaded image assets.

## Validation

- Production web and Windows builds.
- 46 existing mode catalog, create settings, challenge settings and theme tests.
- Browser checks of all six mode setup screens, desktop and mobile layouts, a light theme, and animation suppression under reduced motion and Lite graphics.

Use the project's usual install and build commands (`npm ci`, then `npm run build`).
