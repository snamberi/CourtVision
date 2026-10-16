/* Take-over moments: start a real NBA league at a famous moment, running the team at its centre.
 * `year` is the season's start year (2010 = 2010-11); `team` is that season's team abbreviation in the NBA data. */

export interface TakeoverMoment { id: string; year: number; team: string; title: string; blurb: string }

export const MOMENTS: TakeoverMoment[] = [
  { id: 'jordan-rookie', year: 1984, team: 'CHI', title: 'A rookie named Michael', blurb: 'Chicago just drafted Michael Jordan third overall. Build a champion around him before anyone else figures it out.' },
  { id: 'magic-kareem', year: 1979, team: 'LAL', title: 'Magic meets Kareem', blurb: 'The Lakers pair rookie Magic Johnson with Kareem Abdul-Jabbar in the first season with a 3-point line.' },
  { id: 'kareem-milwaukee', year: 1969, team: 'MIL', title: 'Year two in Milwaukee', blurb: 'A second-year franchise and the most wanted rookie in the country. Turn the Bucks into a contender fast.' },
  { id: 'shaq-kobe', year: 1996, team: 'LAL', title: 'Shaq signs, Kobe arrives', blurb: 'Shaquille O\'Neal joins the Lakers and an 18-year-old Kobe Bryant comes in via trade. Make it work.' },
  { id: 'lebron-rookie', year: 2003, team: 'CLE', title: 'The Chosen One', blurb: 'Cleveland drafts LeBron James from just down the road. Win enough, fast enough, to keep him home.' },
  { id: 'big-three-boston', year: 2007, team: 'BOS', title: 'The new Big Three', blurb: 'Kevin Garnett and Ray Allen join Paul Pierce in Boston. The window is open now; it will not stay open.' },
  { id: 'decision', year: 2010, team: 'CLE', title: 'The summer LeBron left', blurb: 'LeBron took his talents to South Beach. Rebuild the Cavaliers from the wreckage.' },
  { id: 'harden-houston', year: 2012, team: 'HOU', title: 'The Beard lands in Houston', blurb: 'James Harden was traded to the Rockets days before the season. Build a contender around your new star.' },
  { id: 'durant-gone', year: 2016, team: 'OKC', title: 'Durant is gone', blurb: 'Kevin Durant left for Golden State. Russell Westbrook stayed. Prove Oklahoma City can still win.' },
  { id: 'davis-wants-out', year: 2018, team: 'NOP', title: 'Anthony Davis wants out', blurb: 'Your superstar will ask for a trade this season. Convince him to stay or get a haul for him.' },
  { id: 'kawhi-leaves', year: 2019, team: 'TOR', title: 'Champions without Kawhi', blurb: 'Toronto won its first title, then Kawhi Leonard left for the Clippers. Defend the crown anyway.' },
  { id: 'process', year: 2014, team: 'PHI', title: 'Trust the Process', blurb: 'Philadelphia is all picks and patience. Turn the youngest roster in the league into a winner.' },
];

export const momentById = (id: string) => MOMENTS.find(m => m.id === id);
