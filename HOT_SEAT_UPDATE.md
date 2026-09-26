# The Hot Seat: owners, job security and a GM career

Your decisions now have consequences for you, the general manager.

## Owners and goals
- Every team has an owner with a personality: **Win-Now**, **Patient Builder** or **Money-First**. Owners are generated once per league (unique names) and saved with it; older leagues gain them on load.
- When a regular season starts, your owner sets **2–3 goals** from your roster's strength and their personality: win the title or reach the Finals (contenders), win a series or make the playoffs, beat last season's wins, develop young players, turn a profit or get under the tax.
- **Home** shows an Owner's Office panel: owner, job security meter and each goal's live status (on track, at risk, off track, met, missed).

## Job security
- A 0–100 meter. At each offseason the owner reviews your season: goals met or missed (weighted), playoff result and finances.
  - Win-Now owners weigh results more; Patient owners soften bad seasons; Money-First owners count finances double.
  - Your first season with a team is a honeymoon: bad results cost half.
- Outcomes: **Extended** (75+), **Retained**, **Hot seat** (under 45) or **Fired** (under 25, or under 40 while already on the hot seat).
- You are never fired after your first season with a team, after winning the title, in Sandbox mode, or when "The owner can fire me" is unchecked in the GM Office.

## Fired
- The owner's review opens after the season (also after Auto Play, which stops at a firing so you choose yourself).
- You get up to three **job offers**: teams whose GM was just fired, then the teams with the worst records. Take one (fresh security, honeymoon season, new owner and goals) or **sit out as a spectator**; offers return each offseason.
- AI general managers face the same pressure: up to three are fired each offseason, and it shows up in the news.

## GM Office (Front Office › GM Office)
- Owner, meter and goals with progress bars; the firing toggle.
- **GM career**: record, titles and teams, with a season-by-season table (finish, goals met, security change, review).
- **37 achievements** with pixel trophies (titles, dynasties, 60-win seasons, turnarounds, award winners on your roster, drafting a future MVP, surviving the hot seat, one secret one). New ones appear in the review or as a toast.
- Front office news: hirings, firings, extensions and hot seats.

## Data and safety
- Everything is stored in the optional `league.frontOffice` field (`simulation/frontOffice.ts`). Old saves load unchanged and gain it. Nothing here changes game simulation.
- Tests: `tests/frontOffice.test.ts` covers owners, goals by team tier, spectator leagues, a full season review, firing → offers → hiring, the Sandbox and toggle protections, and achievements.
- Browser-checked: Home panel, GM Office, an Auto Play season ending in a firing, the review dialog, job offers and taking a new job.

Also in this update: stronger contrast on the Trade builder (picked players and picks are highlighted).
