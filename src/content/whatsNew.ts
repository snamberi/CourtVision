/*
 * The "What's new" popup: shown once on the main menu after an update, to players who were here before it.
 * Add new entries at the top; the id must sort after the previous one (a date works).
 */
export interface Release { id: string; title: string; items: string[] }

export const RELEASES: Release[] = [
  {
    id: '2027-03-17',
    title: 'Two new game modes: Survival and Story Mode',
    items: [
      "**Survival (new mode):** start with ten all-time greats. Beat a real team from history and they claim one of your best; sign one of theirs. Tougher teams every round, a real champion every fifth (beat it for a Shield). One loss and it's over. Daily Survival, three difficulties, share card.",
      "**Story Mode (new mode):** Street to the League. From a park with no nets to your NBA rookie season in five chapters: choices that matter, key games played on the real engine with you on the floor, your best friend Dre, Coach Ray, your rival Marcus \"Ice\" Vance, and four endings.",
      "**Time Machine (Franchise):** take any real team (the '96 Bulls, the '16 Warriors, the '67 76ers) to any season in NBA history and run it there, against that year's real league.",
      "**Hands-off Franchise:** one switch in the Play menu handles everything for you: All-Star Weekend, Deadline Day, press conferences, injury calls, staff calls, locker-room moments, the Year in Review and the owner's verdict. Auto Play now works from any point of the season, playoffs and offseason included.",
      "**Owner's demands:** losing? The owner sets a short ultimatum (win 6 of the next 10). Meet it and your job is safer; miss it and you're on the hot seat.",
      "**League Hunt:** win a hunt without losing a series and a secret 11th series opens, against the greatest team ever assembled.",
      "**82-0 Challenge:** a trade window at the All-Star break, and injuries (about one a season) to play through.",
      "**Career Mode:** your draft-class rival, a comeback story after a long injury, and a signature move when a superstar trait reaches full power.",
      "**Daily Grid:** themed weeks (Awards Week, Draft Week, Ring Week...) and grid codes: send a friend your endless grid and compare scores.",
      "**New achievements and titles:** Category King, Last One Standing, Street Legend and more.",
    ],
  },
  {
    id: '2027-03-10',
    title: 'Balance update: superstar traits, season goals and closer games',
    items: [
      "**Athleticism:** a career player past 99 tires slower, needs fewer breaks and gets hurt less. At 110 he plays the whole game, close to 48 minutes.",
      "**Body:** he owns the paint. More of his shots come at the rim and he finishes them at a much higher rate, with fewer injuries.",
      "**Height:** every inch past 7'0\" means more rebounds and blocks. A 7'8\" giant grabs about 7 more boards and 3 more blocks than a 6'8\" big.",
      "**IQ & Clutch:** he runs the offense. The ball finds him, he sets teammates up (about 8 more assists at 110), takes better shots, and everyone shoots better with him on the floor. That means more wins and more titles.",
      "**Balance:** even a maxed-out legend has limits. No more 40 rebounds or 85% shooting: he tops out around Wilt's numbers.",
      "**Closer games everywhere:** big leads shrink now (the trailing team plays with urgency, the leader eases off), so far fewer 30-point blowouts. Every team's best players play more (about 36 minutes) and stars get the ball back more often.",
      "**Superstar traits:** your career player's Ratings tab shows Iron Man, Paint Beast, Skyscraper and Floor General: what each one does now, and how far you are from full power at 110.",
      "**Season goals:** three goals every season, set from your last one (score more, make the All-Star team, win MVP...). See how you did after the season, and your career total on the Career stats tab.",
      "**League ranks:** the season recap shows where you finished in the league in points, rebounds, assists, steals and blocks.",
      "**Career highs:** your best single games and your double- and triple-double counts.",
      "**All-time ranks:** where your career totals rank against every NBA player since 1946, and how many points you need to pass the next legend.",
      "**82-0 Challenge:** Category Draft now lives inside the 82-0 Challenge (Category Roll and Slot Spin), not as its own card on the menu.",
    ],
  },
  {
    id: '2027-03-03',
    title: 'The Category update: Daily Grid, Draft Battle and 180 categories',
    items: [
      "**Daily Grid (new quick game):** three teams down the side, three categories across the top. Name a player for every square in nine guesses. Deeper cuts score more rarity points. A new grid every day, a streak, endless grids and a spoiler-free share.",
      "**Draft Battle:** one category, two GMs, a snake draft (1-2-2-1). Eight players each, then a best-of-seven. Play Rookie Rick, Pro Paula or Legend Lou, or pass the device to a friend.",
      "**Custom categories:** build your own from up to three (\"Lakers × 90s players × All-Stars\"), see how many players fit and its tier, draft from it, and send the code to a friend.",
      "**Category Roll:** the game rolls a category (MVPs, 90s players, Duke, No. 1 picks, 7-footers, the Lakers, Spain, Olympians, Kobe's teammates, No. 23s... 180 of them) and you pick ANY five as your starting five. Players come in at their prime, unless the category is about a season. No ratings, stats or rarity colours while you pick. A second roll is your bench. Then try to go 82-0.",
      "**Slot Spin:** every one of your ten spots spins its own category. One player from each.",
      "**Tiers:** every category is S (stacked) to D (brutal). Weaker categories pay more, up to ×1.75. Three category rerolls and two lucky rolls (an S or A tier) per run, and an S-tier roll lands with a flash.",
      "**Weekly Category Challenge:** one category for everyone, all week, with its own leaderboard.",
      "**Options:** scouting tips (a word on each player, never a number), a 10-second shot clock, and mixed rolls (\"Lakers × 90s players\"). Each one changes your score.",
      "**Report card:** after the run, every pick is graded against its category: steals, great picks and reaches, next to the best five you could have taken.",
      "**Duels:** challenge a friend to the same rolls. **Category Book:** collection bars for teams, colleges, eras, awards and more, with new achievements.",
      "**League Hunt:** a new Category Draft deck, where every round of spins draws from its own category.",
    ],
  },
  {
    id: '2027-02-24',
    title: 'Court Vision is an app now',
    items: [
      "**Install it:** press **Install app** at the top of the menu. Court Vision gets its own icon and its own window on your PC (Start menu and taskbar), Android phone or iPhone. No browser bar, it plays offline, and your saves come with you.",
      "**One click on Chrome and Edge:** other browsers get a short step-by-step guide for your device. Share courtvisiongame.com/#/install to send a friend straight to it.",
    ],
  },
  {
    id: '2027-02-17',
    title: 'Real faces, 1v1 legends and 15 new things',
    items: [
      "**Real players look like themselves:** Curry, LeBron, Giannis, Luka, Jordan, Kareem (goggles!), Iverson (sleeve!) and about 100 more. Fix any look and share it as a code; your favourite player shows his name and character in your Profile.",
      "**Career Mode:** the top 100 ever at a skill are rated in the 90s and up (the 4th-best finisher ever is about 107), and today's stars all have at least one skill at 100+.",
      "**New modes:** the Legends Tournament (64 legends, 1v1 to 11, a new bracket every week), 3v3 Street (you and two legends against tougher and tougher crews) and GM Career (start as a scout, earn assistant GM, then the GM job).",
      "**On the court:** signature moves (Curry from the logo, Dirk's one-legger, Shaq's drop step), playoff series highlight reels, sneaker squeaks and a crowd that roars in crunch time.",
      "**Your team:** locker-room moments (mentors, clashes, a star who wants more), injury check-ins and comeback games, and moving up on draft night.",
      "**Profile:** a trophy case you arrange, a shareable profile card, tutorial quests that pay XP, friend activity, and TikTok and Instagram on your phone. Long leagues now save smaller and sim faster.",
    ],
  },
  {
    id: '2027-02-10',
    title: 'Online leagues, Clubs, Dynasty Mode and more',
    items: [
      "**Online leagues:** run a GM league with 2-8 friends. Everyone runs a team, presses Ready, and the league moves when all are ready (or the deadline passes). Trades between friends need both of you to agree. Find it under Friends.",
      "**Clubs:** start a club (up to 20 GMs) with a name, tag and badge. Every weekly board you play adds club points; club owners can challenge another club to a one-week clash.",
      "**Dynasty Mode:** a league for 50 seasons and more. Owners sell, teams move, sons of retired stars enter the draft, and a History Book writes a chapter every decade.",
      "**Weekly missions:** five free missions a week in your Profile. Claim them for XP that fills your Season Pass, and earn mission titles.",
      "**Play crunch time yourself:** when you coach a game, the last two minutes of a close game stop on every one of your trips so you call the play.",
      "**Playoffs:** \"Play 1 Game\" now plays one game in every series at once, not just one matchup.",
    ],
  },
  {
    id: '2027-02-03',
    title: 'Steadier sync and twenty small fixes',
    items: [
      "**Cloud sync:** one leaderboard the server turns down no longer stops your whole save from syncing. Your Profile shows a quiet \"Synced 2 min ago\" line instead of a red error.",
      "**Profile:** your card comes first, with your legacy and favourites side by side under it.",
      "**82-0:** the lineup warnings wait until you have five players, and your team list follows the lineup you set.",
      "**Phones:** the bracket says to swipe for later rounds, free agents' \"Last season\" tag is a short LS, keyboard hints are hidden on touch screens, and Career Mode tabs are bigger.",
      "**Smaller things:** \"1 pick\", \"1 game\" and \"1 player\" instead of \"1 picks\", room inside the All-Time Draft panel, the World Games country picker first, and a clear message when a GM search can't reach the server.",
    ],
  },
  {
    id: '2027-01-27',
    title: 'A roomier Profile and Leaderboards',
    items: [
      "**Stats and ratings:** player stats are back to one decimal (24.6 points, 47.3% shooting), never more. Ratings and attributes (mid-range, speed and the rest) now show as whole numbers instead of 44.783.",
      "**Titles:** your name with the title you're looking at, a count of how many you have, an All/Unlocked/Locked filter, an icon and progress bar on every title, and long groups that open with Show all.",
      "**Title colours:** every colour shows its full name, a swatch, and your own title in that colour (it used to show one letter).",
      "**Profile:** every section is its own card with an unlocked count, and a bar under your card jumps straight to any of them. Phones fit more per row.",
      "**Leaderboards:** bigger tabs, the boards grouped into All time, This week and Today, and a proper header for each board.",
    ],
  },
  {
    id: '2027-01-20',
    title: 'Friends, your streak and an 82-0 lineup',
    items: [
      "**Friends page:** the phone's Friends app opens your crew: the GMs you follow and how you stack up, friends who passed you this week, Find a GM, and every way to play a friend.",
      "**Your streak:** tap the Streak app for your streak, your best, and every streak reward with how many days are left.",
      "**A cleaner header:** Settings is a gear, and once you sign in your profile lives on the phone instead of the header.",
      "**82-0, your rotation:** pick your own five starters and bench order (tap two players to swap), or leave it to the coach.",
      "**82-0 spin helpers:** three rerolls and two lucky spins a run. Quick Spin: send a card back, or make the next spin a sure Great or Star. Franchise Spin: three team-or-era rerolls and two lucky rolls with a Great or a Star waiting.",
      "**Career Mode:** the Retired list shows three; Show more opens the rest.",
    ],
  },
  {
    id: '2027-01-13',
    title: 'Ten phone looks and twenty fixes',
    items: [
      "**Ten looks for the menu phone:** Courtside, Hardwood, Home jersey, Neon and Handheld on the Level Road; Frost, Gold, Lava, Galaxy and Diamond on the Trophy Road. Pick one under **Menu phone** in your Profile.",
      "**Quick games on a phone:** all four games in view, a tidy era picker and record boxes that share the row.",
      "**Player Stats:** the search and filters fit a phone, and before tip-off the page says so instead of asking you to lower the games filter. Stats pages light up League on the phone tab bar.",
      "**Cleaner pages:** Settings tools sit flat in their cards, Graphics is three plain choices, the week's challenges line up with the game modes, and coming-soon slots stay small on phones.",
      "**Roster:** retiring a number is tucked under one line and fills in the number he wore. Trade screens show salaries as $20.84M, not $20,839,187.",
      "**Little words:** 21st, not 21th; 1 season, not 1 seasons; and undrafted steals say \"went undrafted\" instead of \"went th\".",
      "**World Games mode:** Play again keeps your last twelve.",
    ],
  },
  {
    id: '2027-01-06',
    title: 'The World Games',
    items: [
      "**The World Games, every four summers:** in your leagues, right after the draft, the best players go home to play for their countries: twelve national teams, three groups, then the quarterfinals, semifinals and the medal games under FIBA rules.",
      "**Medals for good:** gold, silver and bronze stay on every player who won them, show on their profile and count for the Hall of Fame. Real players arrive with their real medals from 1992 on (Jordan's 1992 gold, LeBron's three).",
      "**AI or you:** the AI plays every country by default. Pick a country in the league's World Games page (or in New Franchise settings) to choose its twelve and play it round by round.",
      "**New in New Franchise: World Games mode.** Coach a national team at a real Games (Barcelona 1992 to Paris 2024) with its real players of that season, or the Fantasy Games with every player in history at his best. No contracts or free agency: pick twelve and win medals.",
      "**Real national teams:** every international player in the NBA now plays for his real country (Jokić for Serbia, Dončić for Slovenia, Giannis for Greece).",
      "**A cleaner menu:** the header holds just Sign in, Settings and Discord; Leaderboards, Friends, your Profile and your streak live on the new phone in the corner.",
    ],
  },
  {
    id: '2026-12-30',
    title: 'Endless quick games, an NBA Quiz and a new way to start',
    items: [
      "**NBA Quiz:** ten questions a round on champions, MVPs, Finals MVPs, Rookies of the Year, No. 1 picks, scoring titles and career numbers. Pick an era, answer fast for bonus points, and play as many rounds as you like.",
      "**Play any time:** Guess the Player has an **Endless** mode (a new player every round, famous or deep cuts) after the daily puzzle, and the Bracket Challenge has **Random brackets** from any era.",
      "**Pick, then Play:** click a mode to pick it, then press **Play** on its card.",
      "**New Franchise:** one page to start any GM league. Choose a real NBA league or a random one, its name, starting season and difficulty, or take the **Rebuild Challenge** or the **All-Time Draft**.",
      "**League settings before you start:** game style, games a season, quarter length, rules era, injuries, the trade deadline, the salary cap and more.",
      "**Roomier Settings:** every setting has its own card.",
      "**Whole-number stats:** points, rebounds, assists, percentages and ratings now read 23, not 23.4.",
    ],
  },
  {
    id: '2026-12-23',
    title: 'Quick games, five new looks and a cleaner menu',
    items: [
      "**Quick games:** a daily **Guess the Player** (six guesses, a streak and a shareable grid), **Higher or Lower** with real career numbers, and a weekly **Bracket Challenge** of sixteen all-time teams. Each has a weekly board and earns XP.",
      "**Five redesigned looks:** Stat Terminal, Pro Dark, Scoreboard (with a full pixel arena), Cartridge and the original Court Vision. Switch any time with the new **Theme** button.",
      "**A cleaner header:** your level, streak, Leaderboards, your name and Discord on one row; Settings and Theme below.",
      "**Same-spin duels:** send a friend the exact same League Hunt or 82-0 run and compare scores.",
      "**Difficulty everywhere:** Rookie, Pro or Legend in the 82-0 Challenge, Career Mode and the All-Time Draft, plus optional **Show ratings** and **Show rarity colours** switches to challenge yourself.",
      "**Stats in your runs:** per-game stats, an MVP and a record book of your best single games in the 82-0 Challenge and League Hunt.",
      "**Weekly recap and rival alerts:** a look back at your week on Monday, and a heads-up when a friend passes you on a board.",
      "**On phones:** GM mode has a tab bar along the bottom (Home, Team, Trade, League, More), and pop-ups no longer cover the page.",
      "**Lots of fixes:** the Play button counts your own games left, no conference rank before a game is played, and many layout fixes on small screens.",
    ],
  },
  {
    id: '2026-12-16',
    title: 'The 82-0 Challenge',
    items: [
      "**New mode: the 82-0 Challenge.** Build a ten-man team and a coach, play all 82 games against real teams from every era, then four playoff rounds. The goal: **82-0, then 16-0.**",
      "**Quick Spin:** ten spins (five starters by position, five off the bench) and a coach spin. **Franchise Spin:** each spin rolls a franchise and an era, and you pick ONE player from everyone who played there, at his best season with them. One team reroll, one era reroll and one **Absolute Prime** boost.",
      "**Boss teams on the schedule:** Wilt's Sixers, the 33-straight Lakers, Bird's Celtics, the **72-10 Bulls** and the **73-9 Warriors** (both versions). Beating one is worth bonus points.",
      "**Lineups and chemistry matter:** start a guard and a big; real teammates, franchise-mates and famous rivals play better together. Every game uses the rules of the opponent's era.",
      "**Scored, daily and rewarded:** every run gets a score (wins, margins, bosses, the playoffs). The **Daily 82-0** gives everyone the same spins, with a weekly board. Go 82-0 for the **Undefeated** title and frame, 98-0 for the gold **Perfection** ones.",
      "**Mode cards** on the menu now show how long a sitting takes, what kind of game each mode is, the most popular and most fun picks, and a **Continue** chip for anything you have in progress.",
      "**Mode of the Week:** one mode earns **double XP** every week. It's on the menu.",
      "**Career Mode big moments:** a title, an MVP, a 50-point night or a playoff heartbreak now asks you to make a call, worth Legacy or a summer of training.",
      "**Hunt squad to 82-0:** win a League Hunt, then take that squad into an 82-0 season.",
      "**Share in 9:16:** 82-0 and League Hunt share cards now come in a TikTok-ready vertical size, with your whole season as a strip of wins and losses.",
      "**New guides** for the 82-0 Challenge and the All-Time Draft, and a bigger FAQ.",
    ],
  },
  {
    id: '2026-12-09',
    title: 'Profile frames, the Weekly Hunt, a Season Pass and your character online',
    items: [
      "**Profile-picture frames:** nine ornate frames around your character's portrait. Finish a ranked season **#1, #2 or #3** for the gold, silver and bronze winged frames; six more are on the Level Road and the Trophy Road. Pick one on Profile.",
      "**Your character online:** your character (and frame) now travels with your account and stands next to your name on every leaderboard, with the top three on the podium.",
      "**Public profile showcase:** your character, best League Hunt, ranked tier, PvP rating and rarest achievements, plus a **Challenge to a 1v1** button for a friendly match against their hunt team.",
      "**The Weekly Hunt:** one hunt for everyone all week, as many tries as you like. The top 10% when the week ends win the Weekly Hunter title and the hunter's flame aura.",
      "**Season Pass (free) and daily streak:** every XP you earn this month fills a 30-tier pass of trophies and titles; come back each day to build a streak.",
      "**Previews:** see any court floor and share-card frame before you equip it (click a locked one to try it).",
      "**League Hunt is easier and simpler to start:** a new home with big mode tiles and a two-step \"Build your hunt\" (deck, then difficulty). Good, Great and Star cards now come up 7 points more often, and every player on your squad plays **+3** above his card.",
      "**Watch Game looks like a real broadcast:** a close camera follows the ball, the offense spreads the floor, defenders stay on their man with a hand up, the dribble is quick and low, and players walk over to pick up loose balls and go get rebounds.",
      "**TikTok clips and more sound:** make a vertical 9:16 highlight clip with a caption; slams now shake the arena with a dunk sound, and threes get a crowd pop.",
    ],
  },
  {
    id: '2026-12-02',
    title: 'A new League Hunt base, anime gear, detailed coaches and new rewards',
    items: [
      "**League Hunt, rebuilt around you:** the road runs across the top, your starting five stand on a court in the middle with a big PLAY button, the Shop is on the left (players, coaches, boosts, a life and training) and your coach and boosts are on the right. PLAY leaves the shop and starts the series in one click.",
      "**Detailed coaches and refs:** coaches on the sideline and in the hunt now wear real suits with ties, tracksuits, quarter-zips and tuxedos on the same detailed body as the players, and refs wear striped shirts with their crew number and blow the whistle.",
      "**10 new share-card frames and 10 new court floors** on the Trophy Road, from cherry wood and herringbone to neon, lava, gold and galaxy.",
      "**20 anime and TV-inspired character pieces:** a monster trainer outfit, an '80s arcade tee, the survival game tracksuit, the pink guard jumpsuit and mask, demon hunter, web hero, soul reaper, one-punch hero, sorcerer and air monk outfits, a fox spirit mask, spiky ninja and sorcerer hair, idol star eyes, spinning red eyes, a sorcerer blindfold, a katana, and cherry blossom and cursed energy auras. Most are on the Trophy Road.",
      "**Sign in to save your progress:** when you arrive signed out you'll be asked once, with a Continue without signing in button.",
    ],
  },
  {
    id: '2026-11-25',
    title: 'A whole new animation set on the court',
    items: [
      "**35 animations, six frames each:** walking, running, sprinting, backpedalling and defensive slides; stationary and moving dribbles, crossovers, behind-the-back, spin moves, jab steps and pump fakes; jump shots, step-backs, fadeaways, free throws, layups, floaters, dunks and alley-oops; chest, bounce and overhead passes and the catch; rebounds, blocks, contests, steals, box-outs, screens, loose-ball dives, charges, falls, landings and celebrations.",
      "**Smarter movement:** players walk, run or sprint by how far they have to go, their feet match the floor, and they look where they're going. Defenders slide to stay in front, backpedal in transition, close out on the catch and rotate to help on drives.",
      "**Better ball movement:** each pass flies its own way (flat chest passes, bounce passes, high overhead skip passes), crossovers and spins carry the ball from hand to hand, and every shot type has its own motion.",
    ],
  },
  {
    id: '2026-11-18',
    title: 'Longer roads, warrior gear and your own jersey',
    items: [
      "**The Trophy Road goes to 750,000** (a stop every 50,000 after 200,000) and **the Level Road to level 750** (a stop every 50 levels after 250), with new titles, name and title colours, icons and character pieces at every stop.",
      "**Warrior gear for your character:** spiky warrior hair, the prince's flame hair, battle armour, a weighted cape, a warrior tail, warrior boots and, at 750,000 trophies, the super warrior aura.",
      "**Your own jersey:** pick a jersey in the Character studio and choose any team's colours and any number from 0 to 99.",
      "**Better animated icons:** real flames lick round the fireball, the phoenix and the burning crowns; the glint now crosses only the trophy itself; stars twinkle, bolts spark and halos glow.",
    ],
  },
  {
    id: '2026-11-11',
    title: 'Your own character',
    items: [
      "**Your character:** everyone now has a pixel player of their own (a random one to start). Dress it on Profile → Your character: body colour, hair, hair colour, beards, 50 outfits, headwear, eyewear, neck and back pieces, shoes and an aura. It stands in the middle of the main menu.",
      "**Unlock more:** new pieces open with your level, and the Trophy Road now has 40 character rewards: anime-inspired outfits (a martial arts gi, a ninja jumpsuit, a pirate vest, a scout cloak, a checkered haori and more), wild body colours up to rainbow, super spiky hair, wings and animated auras.",
      "**Favourite team and player:** set them on the Profile tab. Your team is picked for you when you choose a team (you can still change it). When a Career Mode wheel or a League Hunt reel lands on your favourite player's rarity, it's him 15% more often, until you get him once in that run.",
      "**Tidier main menu:** your account and the leaderboards are in the header, your GM legacy lives in your profile, and backups, graphics and privacy moved to the new Settings page (the gear).",
    ],
  },
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
