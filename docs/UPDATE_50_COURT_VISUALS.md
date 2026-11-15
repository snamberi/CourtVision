# Update 50 court presentation

The visual concept is implemented with CourtVision's existing code-drawn avatars, rather than replacing player portraits or using the concept illustration as a background.

- Eight court directions use the same player hair, skin, jersey colours and number. Profile and rear views are court-only; roster portraits are unchanged.
- Run cycles show alternating planted feet and recovery steps. Forward/backward movement narrows the leg spread; braking adds a crouch. Landings bend the knees.
- A bounded two-bone arm reach brings nearby hands to the ball during dribbles, catches, passes and finishes, without stretching toward a released ball. Dunk correction is limited to players already near the rim.
- Individual release heights, protective/attacking dribble stances, celebrations and staggered bench reactions add variety. These presentation choices do not change recorded game results or simulation randomness.
- Shadows and possession rings are on a separate floor layer. Players, baskets and the ball are sorted by floor depth. A carried ball follows its carrier in the draw order; closer players can still occlude it.
- Nameplates use separate vertical lanes with the carrier prioritised. Screens have a small floor marker. Off-screen label edges are clamped.
- Hardwood has broader, subtler planks and grain; stands and floor reflections are quieter. Custom floor choices remain supported.
- Bounce cues and ball squash are small. Nets stretch and sway. Scoring particles are fewer and fade faster. Short ball trails are opt-in. Reduced-motion and Lite settings hide decorative effects and bench reactions.
- The live scoreboard is compact and includes a visible shot clock. Playback/camera controls sit immediately below the court, with secondary replay navigation in its own row. Exported clips keep their embedded score strip. Full court and Follow ball remain available.

## Validation

Tests cover the eight directions, foot planting and braking, bounded reaches, dunk correction, continuous ball-height projection, separate label lanes, individual release forms, scene depth order, optional trails and existing viewer controls. Existing motion/continuity tests remain in place.

The final targeted run passed 86 tests across eight files, including all theme checks. TypeScript, the production build and lint passed; existing lint and build-size warnings remain.

Sprite sheets and six court snapshots were rendered from the actual SVG components and inspected. The side-profile face was revised after inspection. Interactive desktop/mobile browser playtesting remains outstanding; static SVG checks do not verify timing, responsive HTML layout or device performance.
