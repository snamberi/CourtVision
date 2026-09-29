/*
 * The "What's new" popup: shown once on the main menu after an update, to players who were here before it.
 * Add new entries at the top; the id must sort after the previous one (a date works).
 */
export interface Release { id: string; title: string; items: string[] }

export const RELEASES: Release[] = [
  {
    id: '2026-11-04',
    title: "The Owner's Box",
    items: [
      "**Own a team:** pick \"Own a Team\" when you start a league (or open Front Office → Owner's Box). An AI GM you hire runs the roster; you set the goal (title, playoffs, rebuild, profit) and the budget, read his report card and hire, extend or fire him and the head coach.",
      "**Three GM styles:** the Trade Shark trades and bids hard, the Collector builds through youth, the Old-School GM wants veterans. Their style really changes how your team is run.",
      "**Your arena and your city:** build a new arena with luxury suites and your name on it (it shows on the court), sell the naming rights, pick the team colours, or move the team to a new city on the map if the other owners approve. The fans you leave behind protest.",
      "**The league office:** vote with the other owners on a four-point line, the shot clock, the play-in, hand-checking, the three-point line and the season length. Passed rules really change the game engine. Cities bid for expansion teams, and small-market teams sometimes pack up and move.",
      "**Owner legacy:** titles, deep runs, profit and your arena build an owner legacy and a place in the Owners' Hall of Fame. It feeds the Trophy Road and unlocks the Team Owner and Tycoon titles, the Tycoon gold title colour, a Skybox profile icon and a gold suit for your coach.",
    ],
  },
  {
    id: '2026-10-28',
    title: 'A slot-machine League Hunt and a cleaner Career Mode',
    items: [
      '**League Hunt draft is a slot machine:** all seven slots spin at once. Hit STOP, lock one, the rest respin, until your squad and coach are locked.',
      '**League Hunt is tougher:** every team you face plays 5 above its rating. Shop boosts (two per hunt) are now separate from series-win boosts (three), and your team focus is set once at training camp.',
      '**Career Mode looks cleaner:** everything is centered, the hub puts Continue first, and your career has tabs (Offseason, Last season, Ratings, Career stats) with Play always on top.',
      '**The wheel:** nothing about where it lands shows until it stops, and the strip never runs out of players. Lucky Spins now always land on a Star or a Great, and the Prime Boost is one free boost.',
      '**Your player:** a live prime overall as you build, and the same attribute names everywhere.',
      '**Faster:** League Hunt games score like real NBA games, the season before your draft starts playing as soon as you open Career Mode, and season sims do less busywork.',
    ],
  },
  {
    id: '2026-10-21',
    title: 'The Trophy Road, trading cards and road trips',
    items: [
      '**Trophy Road:** wins, titles, stars and cards earn trophies. Every 5,000 up to 200,000 unlocks something legendary: animated name colours and profile icons, title colours, six new app looks with moving backdrops (Aurora, Royal Court, Galaxy, Hallowed Hall, Eclipse, Immortal) and titles. Your title now shows under your name everywhere, leaderboards included.',
      '**Trading cards:** every player gets a card each season (rookie card, All-Star foil, champion ring, MVP gold, legendary holo). Your roster\'s cards arrive when a season ends, plus packs to open. Complete team sets and share any card as an image (League → Card Album).',
      '**Road trips:** your team on a pixel map of the US. Long flights, time zones and short rest wear teams down; pick rest days, a team dinner or push through on each trip.',
      '**Halftime speech:** when you coach a game live, the tape stops at the half. Fiery, calm, call out the star or praise the bench: players react by personality and the score. The best turnaround makes your season reel.',
      '**GM rivals:** three named GMs (a trade shark, a youth collector and an old-school GM) remember your trades, hold grudges, won\'t take your calls if you fleece them, and bring their own agendas to Deadline Day.',
      '**Franchise timeline:** any team\'s history as a scrollable timeline of banners, big trades, retired numbers, playoff runs and arena upgrades. Tap a season for its roster and awards; share it as one long image.',
      '**More character:** coaches work the sideline in their own outfits (suit, quarter-zip, tracksuit…) and react to the game; a named, numbered crew of three refs signals fouls. Player bios show family: brothers, fathers and sons, including real NBA families, and retired stars\' sons entering the draft.',
    ],
  },
  {
    id: '2026-10-14',
    title: 'Rivalry Week, chemistry and Legend Challenges',
    items: [
      '**Rivalry Week:** twice a season your game against your biggest rival gets the build-up: a trash-talk press conference, a hype meter on the dashboard, and on the night a striped rivalry court with a crowd on its feet. Win it for bragging rights and a morale boost; lose it and the fans let you know. Talk trash and the swing gets bigger.',
      '**Chemistry web:** on the roster page, lines between teammates grow the longer they play together; burying one on the bench weakens a bond and a trade breaks it. Strong duos play a little better together and get their own "DUO" callout when one sets up the other.',
      '**Combine drills:** before the draft, run up to three prospects a year through a shooting drill, a sprint and a vertical jump. Each drill reveals the hidden skills it tests (Scouting → Combine Drills).',
      '**Arena upgrades you can see:** a bigger video board, arena lights, a loud crowd section and a mascot (Finances → Business). Each shows up on your court and helps attendance and your home-court edge.',
      '**Legend Challenges:** short scenarios from NBA history, like the \'98 Finals as the Jazz or stopping the 73-win Warriors from 3-1 down. Pick a game plan before each game and chase three stars (League Hunt → Legend Challenges).',
      '**On the court:** players move at a more natural speed, the ball bounces and rolls, some misses go out of bounds, and league rebound totals are back to NBA levels. Better floors, team logos and crests.',
    ],
  },
  {
    id: '2026-10-07',
    title: 'Your players, animated, and real plays',
    items: [
      '**The players you know, now animated:** on the court every player looks exactly like his portrait again (same face, hair, beard, headwear and jersey), with frame-by-frame runs, dribbles, jump shots, layups, dunks, passes, defence, rebounds and celebrations.',
      '**Edit look:** change any player\'s skin tone, hair, hair colour, facial hair and headwear from his profile, in any league (it\'s cosmetic, so it doesn\'t count as Sandbox). It shows everywhere, on the court too.',
      '**Real plays:** possessions run a set that fits how they end: pick and roll, pick and pop, dribble handoffs, isolation, pin-down screens for shooters, backdoor cuts, screen and roll, post-ups and horns. Off the ball, players space the floor, lift and cut. The broadcast names each set.',
      '**Skip Deadline Day:** "Sim Deadline Day" in the Play menu runs it to 3 PM in one go, and "Auto-sim Trade Deadline Day" plays straight through it, like All-Star Weekend.',
    ],
  },
  {
    id: '2026-10-06',
    title: 'Players that really move',
    items: [
      '**Frame-by-frame animation:** players on the court are now drawn side-on pixel athletes with their own skin, hair, beard, headwear, kit and number. They have run cycles, standing and on-the-move dribbles, jump shots (gather, rise, set, release, follow-through, landing), layups with the knee drive, dunks that hang on the rim, free throws, chest passes, defensive slides, contests, rebounds, screens and celebrations.',
      '**A real hoop:** a padded stanchion in the home colours behind the baseline, a steel post and arm, the glass, an orange rim over the players\' heads and a pixel net that swishes. Shots now arc up to it.',
      '**Pixel icons everywhere:** the heat check, the office phone, the reel buttons, League Hunt hearts, stars and arrows use the game\'s own pixel icons instead of emoji.',
    ],
  },
  {
    id: '2026-10-05',
    title: 'Blind spins, the season reel and more',
    items: [
      '**League Hunt blind spins:** ratings and stats are hidden when you spin. You see the player, his season, his team and that year\'s awards, then the cards flip over to show what you took and what you passed on. Your picks earn a **draft grade**, and your best one is kept.',
      '**Season reel:** the Year in Review opens with a 20-second pixel video of your season. Save it as a GIF to share.',
      '**Big-moment camera:** in watched games, dunks, blocks, clutch threes and game-winners get a zoom, a crowd flash and a slow-motion replay. Turn it off under Camera & display.',
      '**Trade scale:** the two packages sit on a balance, weighed the way the other GM sees them, and his face tells you if he would say yes before you send it.',
      '**Your office:** the dashboard opens on a pixel office with your trophies, retired numbers, the owner on the TV, the whiteboard and the phone. Click anything to go there.',
      '**Heat check:** the roster table shows each player\'s last five games as a mini chart, with a flame or ice when he is streaking.',
      '**Online status:** if sign-in or the leaderboards are not working on a site, Community → Online status says exactly which setting is missing.',
    ],
  },
  {
    id: '2026-10-04',
    title: 'New screens in every game mode',
    items: [
      '**League Hunt map:** the ten series now sit on a winding trail through the eras, with your lives as hearts, the semi-boss and boss marked, and your point guard standing where you are.',
      '**Career card:** your player gets a trading card that changes every season: bronze, silver, gold and holo by overall, a rating ring, last season\'s stats, award badges, and a Hall of Fame foil at the end.',
      '**All-Time Draft wall:** a big board of every team by all 13 rounds, filling in pick by pick with portraits, steals and reaches marked. Turn on the 60-second pick clock if you want the pressure.',
      '**Rebuild before and after:** the challenge banner shows the team you were handed next to the team you have now (record, payroll, best three) and a countdown to the title deadline.',
      '**Leaderboard podium:** the top three stand on a pixel podium, your own rank stays pinned at the bottom, and arrows show who moved since last week.',
    ],
  },
  {
    id: '2026-10-03',
    title: 'Ten new looks on the Level Road',
    items: [
      '**Ten more app looks** to earn, one every 25 levels: Front Office, Hardwood, Blacktop, Playbook, Handheld, 90s Broadcast, Neon Grid, 16-bit Arcade, Comic Pop and, at level 250, Championship.',
      '**Tidier look picker:** every card is the same size, "In use" and the unlock level sit on the preview, and nothing gets cut off.',
    ],
  },
  {
    id: '2026-10-02',
    title: 'Five looks, the Player Profile and the Prime Boost',
    items: [
      '**Pick your look:** Court Vision, Cartridge (the light theme), Scoreboard, Pro Dark or Stat Terminal. Every screen and every mode changes. Switch any time under Player Profile → App look.',
      '**Game modes first:** the main menu opens on the six modes; the weekly challenges and your records sit below them.',
      '**Player Profile:** the GM Locker now lives in your profile, with tabs for your card, the Level Road, the trophy room, achievements and backups.',
      '**Level Road to 250:** a reward every five levels: 30 new pixel icons, new name colours, titles, card frames and court floors. Level-up notes now appear in the bottom-left corner.',
      '**Career Mode:** the wheel builds your player on the same pixel body board as MyPlayer (click a callout to take it). One **Prime Boost** per player, for a Lucky Spin, puts the player you landed on in his absolute prime, or raises six of his skills 10-20% if he is already there. Never his height, never past 120.',
      '**Fixed:** Auto Play in historical leagues no longer stalls when a player is stuck to a team or another player.',
    ],
  },
  {
    id: '2026-10-01',
    title: 'The All-Time Draft',
    items: [
      '**06 / DRAFT:** thirty teams, thirteen rounds, every player in history at his best. Out-draft the AI GMs, then play the season under any era\'s rules.',
      '**All-Time Draft of the Week:** the same draft order and era for everyone.',
      '**Sign in** from the main menu to keep your progress on every device (as soon as accounts switch on).',
      '**Player profile:** pixel profile icons, name colours and new titles from the leaderboards and your achievements. Open it from the level chip on the main menu.',
      '**Career Mode:** two Lucky Spins (Stars and Greats 2.5x as likely), the all-time greats come up most among Stars, and a Star brings +3 to every skill. MyPlayer rolls your draft stock (up to Generational) and builds him part by part.',
      '**Fairer leagues:** new random leagues are dealt out like a draft, and no AI team stacks deal after deal.',
      '**Smarter AI front offices:** trades make contenders better instead of gifting veterans for bench kids, teams use their cap room on real depth, rotation players re-sign, and Auto Play now has in-season trades. Trade offers to you make sense, and a deal you decline isn\'t pitched again.',
      '**31 new achievements** for Career Mode, League Hunt, Rebuild, the Draft, PvP, Ranked, weekly challenges and daily goals, in the GM Locker. What you already did counts.',
    ],
  },
  {
    id: '2026-09-30',
    title: 'Accounts, leaderboards, ranked and PvP',
    items: [
      '**Accounts (optional):** sign in with Discord, Google or an email link. Your level, trophies, records and retired careers follow you to every device.',
      '**Community:** leaderboards for GMs, created players, the weekly challenges, the Daily Legend and every Rebuild, plus public profiles and friends.',
      '**Ranked seasons:** one a month, from Bronze to Legend. Reach Gold or higher to unlock that title.',
      '**League Hunt PvP:** your finished hunt squad against other GMs\' squads, best of seven, Elo-rated.',
    ],
  },
  {
    id: '2026-09-29',
    title: 'Levels, daily goals and online leaderboards',
    items: [
      '**GM Profile:** one level across every mode. Everything you have already won counts. Unlock share-card frames, court floors and titles in the GM Locker.',
      '**Daily goals:** three small goals a day in any GM league, like a 40-point game or three straight wins, for XP.',
      '**Online leaderboards:** post your Rebuild and Career of the Week results and see the top 100.',
      '**League codes:** every new league has a code. Send it to a friend and they start the exact same league.',
      '**Highlight GIFs:** turn any highlight in Watch Game into a GIF that plays on Discord.',
    ],
  },
  {
    id: '2026-09-28',
    title: 'Weekly challenges and an installable app',
    items: [
      '**Rebuild of the Week:** one scenario and one twist for everyone, from the same league, until Monday.',
      '**Career of the Week:** everyone spins the same wheel in the same league. Chase the best Legacy Score.',
      '**Seven new Rebuilds:** the 11-71 Mavericks and Nuggets, the 12-70 Nets, Wade alone in Miami, Orlando after T-Mac, the 13-69 Hawks and the young Giannis Bucks.',
      '**Install Court Vision:** add it to your home screen or desktop. It opens full screen and plays offline once loaded.',
      '**Lighter on older phones:** fewer effects and a smaller simulation load on low-memory devices (Graphics, at the bottom of the main menu).',
    ],
  },
  {
    id: '2026-09-27',
    title: 'Backups, share cards and guides',
    items: [
      '**Backup everything:** one file with all your progress; restore it on any device (GM Locker).',
      '**Share cards:** pixel-art images of your Career, League Hunt and Rebuild results.',
      '**Guides:** How to Play, mode guides and an FAQ, linked at the bottom of the menu.',
    ],
  },
];

const KEY = 'courtvision:whatsNewSeen';

/** The releases this player has not seen yet (newest first). First-time visitors see nothing and are marked up to date. */
export function unseenReleases(storage: Pick<Storage, 'getItem' | 'setItem' | 'length' | 'key'> = localStorage): Release[] {
  try {
    const seen = storage.getItem(KEY);
    if (seen == null) {
      let returning = false;
      for (let i = 0; i < storage.length; i++) { const k = storage.key(i) ?? ''; if (k.startsWith('cv-') || (k.startsWith('courtvision:') && k !== 'courtvision:consent')) { returning = true; break; } }
      if (!returning) { storage.setItem(KEY, RELEASES[0].id); return []; }
      return RELEASES.slice(0, 1);
    }
    return RELEASES.filter(r => r.id > seen);
  } catch { return []; }
}

export function markReleasesSeen(storage: Pick<Storage, 'setItem'> = localStorage): void {
  try { storage.setItem(KEY, RELEASES[0].id); } catch { /* storage blocked */ }
}
