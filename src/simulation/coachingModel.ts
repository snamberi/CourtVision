import type { CoachIdentity } from './coaching';
export const STAFF_ROLES = ['head', 'offense', 'defense', 'development', 'trainer'] as const;
export type StaffRole = typeof STAFF_ROLES[number];
export const STAFF_LABELS: Record<StaffRole,string> = { head:'Head coach', offense:'Offensive assistant', defense:'Defensive assistant', development:'Player development coach', trainer:'Athletic trainer' };
export const COACH_ATTRIBUTES = ['offensiveStrategy','defensiveStrategy','adjustments','rotationManagement','playerDevelopment','teaching','talentEvaluation','communication','discipline','adaptability'] as const;
export type CoachAttribute = typeof COACH_ATTRIBUTES[number];
export const SPECIALTIES = ['shooting','ball handling','post play','perimeter defense','big-man development','conditioning'] as const;
export type Specialty = typeof SPECIALTIES[number];
export interface StaffProfile {
  attributes: Record<CoachAttribute,number>; specialties: Specialty[];
  preferredRole: StaffRole; offense: string; defense: string;
  personality: 'patient'|'demanding'|'collaborative'; leadership: 'teacher'|'tactician'|'motivator';
  priority: 'salary'|'contender'|'facilities'|'authority'; experience: number;
  playoffWins: number; playoffLosses: number; coyAwards: number;
  history: {teamId:string; role:StaffRole; from:string; to?:string}[];
  staffRelationships: Record<string,number>;
  developmentHistory: {playerId:string; season:string; before:number; after:number}[];
  formerPlayerId?: string;
}
export const FOCUS_SKILLS = {
  balanced:['offense.shotIQ','defense.defensiveIQ','mental.consistency'],
  'catch-and-shoot':['offense.catchAndShoot','offense.corner3','offense.threePoint'],
  'pull-ups':['offense.pullUp3','offense.longMidrange','offense.ballHandling'],
  'free throws':['offense.freeThrow','mental.composure'], midrange:['offense.midrange','offense.postFade'],
  'contact finishing':['offense.finishing','offense.drivingLayup','physical.strength'],
  touch:['offense.touch','offense.closeShot','offense.postHook'],
  'off-hand finishing':['offense.drivingLayup','offense.touch','physical.balance'],
  'ball handling':['offense.ballHandling','offense.speedWithBall'],
  'ball security':['offense.ballSecurity','offense.decisionMaking'],
  separation:['physical.agility','offense.speedWithBall','physical.acceleration'],
  'passing accuracy':['offense.passingAccuracy','offense.passing'],
  reads:['offense.passingIQ','offense.decisionMaking'],
  'pick-and-roll reads':['offense.passingIQ','offense.ballHandling','offense.passingAccuracy'],
  positioning:['defense.defensiveIQ','defense.helpDefense'],
  'screen navigation':['defense.pickAndRollDefense','defense.perimeterDefense'],
  contests:['defense.contest','defense.closeout'],
  'rim protection':['defense.rimProtection','defense.blockTiming'],
  rebounding:['defense.defensiveRebounding','offense.offensiveRebounding'],
  strength:['physical.strength','physical.balance'], conditioning:['physical.stamina','physical.durability'],
  mobility:['physical.agility','physical.acceleration'],
  discipline:['mental.discipline','defense.defensiveDiscipline'], consistency:['mental.consistency','offense.offensiveConsistency'],
  composure:['mental.composure','offense.decisionMaking'],
  'secondary handler':['offense.ballHandling','offense.passingIQ'],
  'stretch big':['offense.threePoint','offense.corner3'],
  'defensive specialist':['defense.perimeterDefense','defense.defensiveIQ'],
} as const;
export type TrainingFocus = keyof typeof FOCUS_SKILLS;
export const TARGET_ROLES = ['balanced','lead guard','secondary creator','movement shooter','interior anchor','stretch big','defensive specialist','bench creator'] as const;
export type TargetRole = typeof TARGET_ROLES[number];
export const PRACTICE_TYPES = ['offense','defense','skills','conditioning','film','recovery'] as const;
export type PracticeType = typeof PRACTICE_TYPES[number];
export type Intensity = 'light'|'normal'|'hard';
export interface PracticeSession { type:PracticeType; intensity:Intensity }
export interface DevelopmentPlan { primary:TrainingFocus; secondary:TrainingFocus; intensity:Intensity; targetRole:TargetRole; coachId?:string; mentorId?:string }
export const PROJECTS = {
  'corner-three': {name:'Add a reliable corner three', focus:'catch-and-shoot', skill:'offense.corner3', threshold:68, specialty:'shooting', impact:'Better corner spacing; requires a dependable jumper.'},
  'secondary-playmaker': {name:'Become a secondary playmaker',focus:'secondary handler',skill:'offense.passingIQ',threshold:68,specialty:'ball handling',impact:'More secondary creation when skills and ball-handling reps are ready.'},
  'weak-hand': {name:'Improve weak-hand finishing',focus:'off-hand finishing',skill:'offense.drivingLayup',threshold:66,specialty:'post play',impact:'Improves finishing touch; does not change player size.'},
  'defend-position': {name:'Learn another defensive position',focus:'screen navigation',skill:'defense.perimeterDefense',threshold:66,specialty:'perimeter defense',impact:'Adds modest adjacent-position suitability only when size and defensive skill permit.'},
  'interior-strength': {name:'Build strength for interior defense',focus:'strength',skill:'physical.strength',threshold:70,specialty:'big-man development',impact:'Stronger interior contests and contact resistance.'},
  'secure-handle': {name:'Reduce turnovers under pressure',focus:'ball security',skill:'offense.ballSecurity',threshold:70,specialty:'ball handling',impact:'Improves possession security; does not guarantee zero turnovers.'},
  'bench-creator': {name:'Adapt to a bench creator role',focus:'reads',skill:'offense.decisionMaking',threshold:66,specialty:'ball handling',impact:'Learns secondary creation with the second unit.'},
} as const;
export type ProjectKey = keyof typeof PROJECTS;
export interface PlayerProject {key:ProjectKey; progress:number; started:string; days:number; status:'active'|'stalled'|'partial'|'completed'; obstacle:string}
export interface DevelopmentEntry { date:string; season:string; kind:'training'|'project'|'badge'|'conversation'|'offseason'|'rotation'; text:string; changes?:Record<string,number> }
export interface PlayerTraining {
  plan:DevelopmentPlan; pattern:'early contributor'|'steady improver'|'late bloomer'|'raw project'|'specialist'|'early physical peak';
  mentorBond?:number; pendingChanges?:Record<string,number>;
  workload:number; practiceDays:number; injuredDays:number; roleFamiliarity:number;
  familiarity:Record<string,number>; teamId:string;
  project?:PlayerProject;
  badgeProgress:Record<string,{credit:number; qualifiedGames:number; dryGames:number; stage:'Developing'|'Close to earning'|'Established'; reason:string}>;
  evidence:{ games:number; minutes:number; handling:number; defensiveReps:number; shots:Record<string,{attempts:number;makes:number}> };
  morale:{trust:number;role:number;development:number;discipline:number;promises:number};
  promise?:{kind:'rotation'|'workload';remaining:number;achieved:number;required:number; failures:number};
  brokenPromises:number; lastConversationGame:number; games:number;
  history:DevelopmentEntry[];
}
export interface CoachingReport {date:string;season:string;kind:'weekly'|'monthly'|'offseason';summary:string;items:string[]}
export interface CoachingControl {
  preset:'simple'|'standard'|'deep'; staffAuto:boolean; practiceAuto:boolean; developmentAuto:boolean;
  direction:'contend'|'balanced'|'rebuild'; practice:PracticeSession[];
  lastPracticeDate?:string; lastGameDate?:string; lastRoster?:string; lastAIReview?:number; lastStaffReviewGames?:number; practiceLog?:{date:string;type:PracticeType;intensity:Intensity}[];
  practiceDays:number; adjustmentGames:number; payout:number; payoutSeason?:string;
  reports:CoachingReport[]; reportBaseline:Record<string,number>;
}
export interface CoachingSettings { familiaritySpeed:number; mentorshipImpact:number; moraleImpact:number; trainingFatigue:number; staffBudgetRestrictions:boolean; reportFrequency:'weekly'|'monthly'|'offseason' }
export const DEFAULT_COACHING_SETTINGS:CoachingSettings={familiaritySpeed:100,mentorshipImpact:100,moraleImpact:100,trainingFatigue:100,staffBudgetRestrictions:true,reportFrequency:'weekly'};
export interface RotationPolicy {mode:'fixed'|'performance'|'development'|'matchup'|'playoff'; starters:string[];closing:string[];smallBall:string[];defensive:string[];backupHandler?:string;allowStarterChanges:boolean;allowOverrides:boolean}
export type AssistantStaff = Partial<Record<Exclude<StaffRole,'head'>,CoachIdentity>>;
export const clamp = (n:number,min=0,max=100)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:min));
export const stableSeed = (text:string) => {let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
