# Court Vision — Courtside update

## League creation repaired

Real League creates an empty import workspace before teams exist. Three React state initializers accessed the first player and the first two teams on every render, crashing this flow and one-team imports. Those initializers now run lazily and allow absent teams. The import workspace has a clear setup prompt, and an empty league no longer offers a misleading Play button.

## Rookie awards use experience

ROTY, All-Rookie teams, the ROTY ballot and Rookie Defender now share one eligibility rule: no previous season with a recorded game played. A 24-year-old debutant qualifies; a 20-year-old veteran does not. Zero-game years do not consume rookie eligibility. Age and draft year do not substitute for experience. Existing games-played requirements still apply.

For legacy/imported players without archived career history, the game uses the history available; it does not invent prior seasons. Add the relevant career records when importing experienced players.

## Coaches respond to performance

Coaching → Performance reviews enables or disables automatic rotation adjustments and selects a cadence of 5–10 team games (default 7). Reviews use the latest completed regular-season box scores: production per minute, shooting efficiency, workload relative to stamina, offensive/defensive system fit and positional suitability.

Changes are gradual: at most one starter promotion and up to three minutes transferred per player at each review. Total planned minutes are preserved. A player needs three appearances and at least one regulation game's worth of accumulated minutes before changing roles. Injured players and injury-adjusted targets are protected. TARGET, EXACT and MANUAL minutes are not rewritten; automatic coaching controls AI-minute players and their roles.

The Coaching page explains the latest review, including promotions after strong bench performances and workload-related reductions. Review settings, decisions and timing survive saves and reloads. Reviews run through the shared league engine, including background season simulation, and restart with the new season.

## Watch Game

- Play → Watch Next Game opens the next regular-season game on a pixel court.
- Any saved box score offers Watch Game for a replay.
- Playoffs → Watch Next Game watches the next playoff game, including the Finals. Expand a series' Watch games list to replay earlier games.
- Moving pixel players, passes, shots, rebounds, steals, substitutions, a running scoreboard, game clock and possession commentary follow the recorded simulation events.
- Pause/Play, 0.5×–8× speed, Next Possession, Restart Replay and Sim to End control playback. Controls and the scoreboard stay together while scrolling.
- Three consecutive made three-point attempts trigger an On Fire callout and a flame marker. Only revealed possessions count toward that streak.
- Sim to End skips the remaining playback. Watching, restarting or skipping never simulates or records a second game.

Court movement illustrates the recorded possessions; it is not a separate physics simulation. Results are generated once when a new game is watched, while scores remain hidden until the relevant possession is revealed. Older saved logs are supported; games without logs retain their box scores. Custom two-half games and overtime use the recorded period rules.

## Verification

Automated checks cover rookie experience, rotation cadence, promotions, protected minutes, fatigue, budget conservation, persisted reviews, actual engine participants, replay scoring, three-point streaks and playback controls. The complete suite passes (468 tests, 71 files). TypeScript and targeted lint checks pass. Both web and offline Windows assets were rebuilt.

Browser checks cover empty import setup, one-team CSV creation, full 30-team creation, saving/reopening, playback controls, exact final scores, repeat viewing, rotation persistence, playoff replays and mobile overflow. The Windows package's compiled web assets are browser-tested; the Windows batch launcher itself requires Windows and was not executed in this Linux environment.
