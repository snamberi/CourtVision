/* Every honor a player or team can collect: its trophy, its name and how much it weighs in a career.
 * Prestige feeds the Hall of Fame (an MVP counts far more than a Player of the Week). */

export type TrophyKey =
  | 'champion' | 'fmvp' | 'mvp' | 'dpoy' | 'roy' | 'mip' | 'smoy' | 'cpoy' | 'coy' | 'eoy'
  | 'allLeague1' | 'allLeague2' | 'allLeague3' | 'allDefense1' | 'allDefense2' | 'allRookie1' | 'allRookie2'
  | 'allStar' | 'allStarMvp' | 'risingStarsMvp' | 'threePoint' | 'dunk'
  | 'scoringChamp' | 'reboundingChamp' | 'assistsChamp' | 'stealsChamp' | 'blocksChamp'
  | 'hustle' | 'teammate' | 'sharpshooter' | 'floorGeneral' | 'paintScorer' | 'ironMan' | 'rookieDefender'
  | 'pom' | 'pow';

export interface TrophyInfo {
  key: TrophyKey;
  label: string;
  /** Short name for tight spots (shelf captions). */
  short: string;
  /** Hall of Fame points per win. */
  prestige: number;
}

const t = (key: TrophyKey, label: string, short: string, prestige: number): TrophyInfo => ({ key, label, short, prestige });

export const TROPHIES: Record<TrophyKey, TrophyInfo> = {
  champion: t('champion', 'Champion', 'Title', 7),
  fmvp: t('fmvp', 'Finals MVP', 'FMVP', 12),
  mvp: t('mvp', 'Most Valuable Player', 'MVP', 18),
  dpoy: t('dpoy', 'Defensive Player of the Year', 'DPOY', 9),
  roy: t('roy', 'Rookie of the Year', 'ROY', 4),
  mip: t('mip', 'Most Improved Player', 'MIP', 2),
  smoy: t('smoy', 'Sixth Man of the Year', '6MOY', 3),
  cpoy: t('cpoy', 'Clutch Player of the Year', 'Clutch', 3),
  coy: t('coy', 'Coach of the Year', 'COY', 0),
  eoy: t('eoy', 'Executive of the Year', 'EOY', 0),
  allLeague1: t('allLeague1', 'All-League 1st Team', 'All-League 1st', 8),
  allLeague2: t('allLeague2', 'All-League 2nd Team', 'All-League 2nd', 5),
  allLeague3: t('allLeague3', 'All-League 3rd Team', 'All-League 3rd', 3),
  allDefense1: t('allDefense1', 'All-Defensive 1st Team', 'All-Defense 1st', 3),
  allDefense2: t('allDefense2', 'All-Defensive 2nd Team', 'All-Defense 2nd', 2),
  allRookie1: t('allRookie1', 'All-Rookie 1st Team', 'All-Rookie 1st', 1),
  allRookie2: t('allRookie2', 'All-Rookie 2nd Team', 'All-Rookie 2nd', 0.5),
  allStar: t('allStar', 'All-Star', 'All-Star', 4),
  allStarMvp: t('allStarMvp', 'All-Star Game MVP', 'ASG MVP', 2),
  risingStarsMvp: t('risingStarsMvp', 'Rising Stars MVP', 'Rising MVP', 0.5),
  threePoint: t('threePoint', '3-Point Contest Champion', '3PT Champ', 1),
  dunk: t('dunk', 'Slam Dunk Contest Champion', 'Dunk Champ', 1),
  scoringChamp: t('scoringChamp', 'Scoring Champion', 'Scoring', 3),
  reboundingChamp: t('reboundingChamp', 'Rebounding Champion', 'Rebounding', 2),
  assistsChamp: t('assistsChamp', 'Assists Champion', 'Assists', 2),
  stealsChamp: t('stealsChamp', 'Steals Champion', 'Steals', 1.5),
  blocksChamp: t('blocksChamp', 'Blocks Champion', 'Blocks', 1.5),
  hustle: t('hustle', 'Hustle Award', 'Hustle', 1),
  teammate: t('teammate', 'Teammate of the Year', 'Teammate', 1),
  sharpshooter: t('sharpshooter', 'Sharpshooter of the Year', 'Sharpshooter', 1),
  floorGeneral: t('floorGeneral', 'Floor General Award', 'Floor General', 1),
  paintScorer: t('paintScorer', 'Interior Scorer of the Year', 'Paint', 1),
  ironMan: t('ironMan', 'Iron Man Award', 'Iron Man', 1),
  rookieDefender: t('rookieDefender', 'Rookie Defender of the Year', 'Rookie D', 0.5),
  pom: t('pom', 'Player of the Month', 'POM', 1),
  pow: t('pow', 'Player of the Week', 'POW', 0.25),
};

/** Shelf order: the biggest hardware first. */
export const TROPHY_ORDER: TrophyKey[] = [
  'champion', 'mvp', 'fmvp', 'dpoy', 'allLeague1', 'allLeague2', 'allLeague3', 'allStar', 'roy', 'cpoy', 'smoy', 'mip',
  'allDefense1', 'allDefense2', 'scoringChamp', 'reboundingChamp', 'assistsChamp', 'stealsChamp', 'blocksChamp',
  'allStarMvp', 'coy', 'eoy', 'allRookie1', 'allRookie2', 'risingStarsMvp', 'threePoint', 'dunk',
  'sharpshooter', 'floorGeneral', 'paintScorer', 'ironMan', 'hustle', 'teammate', 'rookieDefender', 'pom', 'pow',
];
