# Workspace layout fix

The screenshot shows a loaded 30-team league with its header visible but no sidebar or page content. This patch removes the workspace's explicit `height: 0` and its children's percentage-height dependency. The workspace now uses natural flex sizing, with stretched, independently scrolling navigation and content panes. The header cannot shrink, and viewport height retains a `vh` fallback.

Only `src/pixel.css` changes application behavior. Saved leagues, simulation, awards, coaching, game replay and player data are unchanged. The included Windows package was rebuilt with the same CSS.

Validation: TypeScript and production builds pass. Web and desktop assets pass browser checks at 1866×950, 1440×900, 1920×1080, 1024×640 and 390×844. Navigation/content wheel scrolling, generated-league creation, returning to the menu, reopening the save, dashboard navigation, game replay and collapsed mobile navigation pass without runtime errors.

The user's exact blank state did not reproduce in the available Chromium browser before the patch. This removes the fragile zero-height layout responsible for that class of failure; a remaining issue on a deployed site requires its URL or console error to distinguish deployment/browser-specific causes.
