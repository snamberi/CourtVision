# Update 50: Design 6 / Mini Athlete

This replaces the earlier C/B pass with the user's selected Mini Athlete direction. The implementation is code-native pixel art, shared by players, user characters, portraits, cards, exported player art and sideline figures. The concept board is a direction reference; the reproducible previews below show the actual implementation.

## Character drawing

The existing 40 × 52 display canvas contains an 80 × 104 raster. The head is compact; exposed arms and calves have shaped silhouettes, the standing arms hang naturally, and shoes, socks, shorts and jersey have distinct proportions. Eyes are drawn directly on the fine grid with a stepped eyelid, white sclera, iris, pupil and a small highlight. Brows and nose shading remain separate. Hair uses warm highlight clusters. Jersey numbers use the team trim color.

Existing IDs, saved appearances, skin and hair choices, hats, goggles, sleeves, outfits, shoes, neck/back pieces and auras remain supported. Cosmetics are composed before proportion mapping; exposed-skin refinement leaves clothing pixels intact. User-avatar sleeve cuffs and gloves were moved to the relaxed arm placement. Fantasy skin and hair patterns keep their recoloring. No save migration or unlock changes are involved.

## Movement drawings and timing

`src/visuals/athleteFrames.ts` contains explicit per-frame joint drawings for 16-frame run, walk, sprint, dribble, defensive slide, jump-shot, layup and dunk cycles. Moving dribbles combine the authored stride with a drawn protective off arm and dribble hand. Running uses contact, compression, passing, push-off and flight drawings, alternating legs and opposite arms. Shoe pitch changes with heel strike, toe-off and recovery. The torso stays upright with a small vertical displacement. Directional projection changes the stride's apparent width without folding the torso. The far arm is behind the jersey and the near arm overlaps it.

Playback exposes discrete poses at 16 FPS while floor and ball positions remain continuous. Stride phase still comes from distance travelled. Automatic pose interpolation, acceleration-based torso shear and forced foot/leg corrections were removed. Jump-shot release/landing exposures are aligned with the recorded shot timeline. Close ball contact still uses a bounded hand reach; released follow-through is preserved. Shoes rotate about their contact edge so planted soles do not penetrate the floor.

The remaining shorter gestures have deliberate exposures of their existing authored drawings. They do **not** all have 16 unique poses: held drawings are repeated, and automatic generated in-betweens are no longer used. Stepbacks, fadeaways, floaters, free throws and lobs reuse the appropriate authored shot drawings with their action-specific adjustments. Actual jump height is supplied by court presentation, separately from the limb drawings.

## Reproduce the visual review

```sh
npx rolldown scripts/preview-characters.ts --platform node --file /tmp/characters.mjs
node /tmp/characters.mjs /tmp/characters.svg
npx rolldown scripts/preview-athlete-motion.ts --platform node --file /tmp/athletes.mjs
node /tmp/athletes.mjs /tmp/mini-athlete
```

The first script renders multiple player identities, saved cosmetic combinations, all eight directions, actions and coaches. The second writes every exposure, a contact sheet and an HTML preview with play/pause and frame scrubbing at 16 FPS. This is rendered game artwork, not the generated concept board. The preview plays one exposure per tick; a watched game chooses exposures using distance and action/contact timing.

Validation covers frame selection, alternating contacts/recovery, opposite arm phases, an upright run torso, loop continuity, preserved identity/customization, all avatar catalog pieces, eight directions, sleeves, hand reach, replay movement/ball continuity and controls. Interactive browser/device performance and subjective playtesting remain separate from these checks. Update 50 stays unmerged.

Final verification: 76 tests across 13 files passed. TypeScript, production and desktop builds passed; lint completed without errors and with existing warnings. The actual renderer's contact sheets and full-court frames were inspected. A sample possession was exported as 132 frames at 16 FPS (8.25 seconds); this is an offline render of the watched-game component, not a browser performance measurement.
