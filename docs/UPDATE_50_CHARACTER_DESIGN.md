# Update 50: original character design restored

At the user's request, both character redesign passes have been removed. The player and user-avatar renderers, matching court sprite renderer, animation rig and presentation anchors are restored to their exact versions at commit `1616860`, immediately before the first character redesign.

This restores the original faces, proportions, hair shading, uniforms, standing poses, outfits, shoes and on-court character rendering across players, user characters, portraits, cards, exports and sideline figures. The newer Mini Athlete pose sheet and its preview are removed. Saved appearance choices, cosmetics and unlock data are unchanged. Resting bench avatars still receive the saved appearance override fix.

The earlier court presentation improvements, movement paths, ball handoffs, full-court/follow-ball controls, 16 FPS pose sampling, audio, themes and other Update 50 features remain. This rollback does not merge or deploy Update 50.

`scripts/preview-characters.ts` now renders the restored artwork for review:

```sh
npx rolldown scripts/preview-characters.ts --platform node --file /tmp/characters.mjs
node /tmp/characters.mjs /tmp/characters.svg
```

Verification: the four character/presentation source files and their existing action/presentation tests match `1616860` exactly. All 71 checks across 12 relevant test files passed, including character identity, cosmetic catalog, replay controls, ball/movement continuity and saved appearance behavior. TypeScript, production and desktop builds passed; lint completed with existing warnings and no errors. The restored character contact sheet was rendered and inspected.
