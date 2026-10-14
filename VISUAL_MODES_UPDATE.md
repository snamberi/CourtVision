# Mode presentation update

- Selecting the Franchise card reveals Play and Continue buttons. Continue opens `#/continue`, which contains Your Leagues, most-recent-first ordering, search, rename, confirmed deletion, and a friendly empty state. Refresh and browser navigation retain the route.
- Franchise, League Hunt, Career and Survival now have their own local pixel scenes: trophy room, boss arena, locker room and damaged court with rising embers. The scenes also appear on the main mode cards.
- Main cards use larger titles, short descriptions, Play actions revealed on selection and expandable How to play instructions. Current saves/runs or completed records appear immediately below each title. Clicking again or pressing Escape clears selection.
- The original pixel emblems float in front of the new room scenes, with a soft colored light, crisp outlines and a pixel floor shadow. Related submode cards retain their own distinct icons. Reduced Motion and Lite graphics disable the floating effects.
- Historical player cards use actual team colors, inset borders, directional lighting and restrained foil for elite cards. Career cards also pick up the player's current team.
- Reels rotate and snap into place, with rarity-colored sparks and a stronger legendary reveal. Hidden-rarity options retain neutral decoration. Reduced Motion and Lite graphics suppress added effects.
- Result screens feature animated numbers, trophy celebrations and MVP spotlights. Share images identify the actual MVP, including the correct season and team kit, in landscape and vertical formats.

No save migrations or simulation balance changes are required. Existing save keys, league data and themes are preserved.

Validation: production build; targeted tests for Continue controls, stored progress, navigation, Hunt draft behavior and Survival; desktop and 390px mobile browser checks for save/resume, room scenes, stop/lock, results and both share formats. Reduced-motion behavior and horizontal overflow were checked.

This archive contains source code. Deploy it through the project's existing build workflow (`npm run build`).
