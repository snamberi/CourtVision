# Update 50 audio

Settings → Music & sound adds an opt-in soundtrack with Chill courtside and Arena energy patterns, synthesized in Web Audio without downloading music assets. Music, menu effects and announcer each have a 0–100 volume control. Preferences stay on the browser.

Button/link/checkbox clicks get a short tone; hash navigation gets a rising cue. Franchise success and error notifications play distinct effects. Watched-game home dunks, threes and late clutch baskets trigger short browser-synthesized announcer lines when both arena sound and the new announcer are enabled. Voice calls have a 4.5-second cooldown and skip while another utterance is speaking; they do not build a queue. Voices are off by default and depend on browser speech support. Existing arena audio and highlight recording remain separate; speech is not mixed into recorded highlights.

The soundtrack is allocated after opt-in and interaction, has only one scheduler, and pauses with voices in hidden tabs. Unsupported audio APIs fail quietly. Music and voices can be tested in Settings. UI clicks do not fire for disabled controls. No game, reward, save or simulation rules change.

Automated checks cover volume normalization, opt-in/unsupported audio, one scheduler, hidden-tab pause/resume and disabling sound. Manual listening on desktop and mobile is still needed for loudness, browser speech pronunciation and autoplay behavior.

For a branch playtest, see the Update 50 preview section in CLOUDFLARE_SETUP.md. Keep main as the production branch and use the release/update-50 Preview URL.
