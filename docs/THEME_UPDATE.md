# Court Vision theme update

All 22 looks now use a shared set of surface, text, action, border, shadow and typography roles. Each look has its own bundled pixel scene. The main menu, theme previews, navigation, dialogs, tables, forms and shared game-mode panels use those roles; specialist game components continue to use the existing palette remapper.

The main menu header is one row. Below 1180px, profile, account and Discord controls move into the account menu; theme and settings stay in the header. The menu closes after an action, on an outside click or on Escape. Escape returns focus to its toggle. Narrow phones use an icon-sized theme control with an accessible name. The in-league header also stays on one row.

The theme picker shows each look's actual scenery and materials. Its Done control stays within reach while scrolling. Fixed cosmetic name and title colours sit on dark nameplates in the light themes. Existing level, trophy and owner-only unlock rules are unchanged.

## Files to customize

| File | Purpose |
| --- | --- |
| `src/theme/skins.ts` | The 22 palettes, materials and font roles |
| `src/theme/skins.css` | Generated CSS roles and scene URLs |
| `src/theme/themes.css` | Shared game styling and individual theme details |
| `src/theme/looks.css` | Main menu and responsive single-row masthead |
| `src/assets/looks/scenes/` | 22 local SVG scenes |
| `scripts/generate-theme-scenes.mjs` | Deterministic scene/token generator |
| `src/components/MenuMasthead.tsx` | Header and compact account disclosure |

Run `npm run theme:assets` after editing the skin definitions or scene generator (Node 22.18 or newer). Generated assets are checked in, so a normal build does not need this step. No image service or external asset host is required. Scene assets are included in the offline cache and Windows package.

## Validation

- Production build, including the Windows edition.
- 32 theme and masthead tests, covering contrast, saved theme selection, unlock gates and disclosure interactions.
- All 22 themes checked at 1440px, 390px and 320px for header wrapping and page overflow.
- Desktop and phone checks of settings, profile, trophy room, Career, League Hunt, 82-0, All-Time Draft, and the Community guest screen.
- A temporary generated league used to check dashboard, roster, standings, trades, free agency, draft, settings and daily schedule.

This is a visual update. Simulation, account permissions, unlock progression and save formats are unchanged. Online sign-in and purchases were not exercised in the local preview.
