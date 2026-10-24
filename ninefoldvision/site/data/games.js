// Every NineFoldVision game. To add a game, copy an entry, give it a new `slug`, and it appears on the Home,
// Games and Updates pages and gets its own page at game.html?g=<slug>.
// status: 'live' (playable now), 'dev' (in development), 'soon' (announced).
// Updates: either list them here under `updates`, or (like Court Vision) generate them from the game's source
// into data/updates-<slug>.js and load that file on the pages that show updates.
window.NFV_GAMES = [
  {
    slug: 'courtvision',
    name: 'Court Vision',
    status: 'live',
    genre: 'Basketball GM & simulation',
    accent: '#f47b20',
    cover: 'assets/img/courtvision-cover.png',
    tagline: 'Free basketball GM game. Run a real NBA franchise from any season since 1946, or chase a perfect season.',
    description:
      'Court Vision is a free basketball management and simulation game that runs in your browser. You run a franchise (drafting, trading, signing, coaching) and every game is played out possession by possession by a full simulation engine, never decided by a coin flip.',
    platforms: ['Browser', 'Windows', 'Installable app (plays offline)'],
    price: 'Free',
    links: [
      { label: 'Play now', url: 'https://courtvisiongame.com', primary: true },
      { label: 'Windows download', url: 'https://courtvisiongame.com/downloads/CourtVision-Windows.zip' },
      { label: 'How to play', url: 'https://courtvisiongame.com/how-to-play.html' },
    ],
    modes: [
      { name: 'Franchise GM', text: 'Draft, trade, negotiate with agents, hire coaches and play through the season, the In-Season Cup, the deadline, the playoffs and the offseason.' },
      { name: 'Real NBA history', text: 'Start a league in any season from 1946-47 to today with real players, real rosters and their real careers, awards and champions.' },
      { name: 'Your Career', text: 'Create one player and live a whole life in the game, from age 13 to the Hall of Fame.' },
      { name: 'Story Mode', text: 'The road to the NBA and fifteen seasons in it, with 80 story cards and choices that come back years later.' },
      { name: '82-0 Challenge', text: 'Build a ten-man team from all of NBA history and go undefeated: 82-0, then 16-0.' },
      { name: 'League Hunt', text: 'Build a six-man squad from any era and win ten best-of-seven series against real teams, each under the rules of its time.' },
      { name: 'All-Time Draft', text: 'Every player in NBA history in one draft pool, each at his best season. Draft against 29 AI GMs, then play a full season.' },
      { name: 'Rebuild Challenge', text: 'Take over a real team at the lowest point in its history and win a championship before time runs out.' },
    ],
  },
];
