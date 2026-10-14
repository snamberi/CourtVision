// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EarnedTrophyRoom } from '../components/presentation/EarnedTrophyRoom';
import { earnedHonors } from '../simulation/earnedHonors';
import { LineupBoard } from '../components/presentation/LineupBoard';
import { resolveTeamIdentity } from '../simulation/teamIdentity';
import type { TimelineSeason } from '../simulation/timeline';
import type { FranchiseHistoryRecord } from '../simulation/league';
import { bossRoster } from '../hunt/bossRoster';
import { newRun, draftBest } from '../hunt/run';
import { cardPool } from '../hunt/cards';
import { huntTeams } from '../hunt/teams';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
afterEach(cleanup);
const season = (year: string, imported = false): TimelineSeason => ({ season:year,wins:60,losses:22,finish:'Champion',champion:true,events:[],record:{season:year,imported,fmvpPlayerId:'Stephen Curry',fullAwards:{mvp:{playerId:'Stephen Curry',teamId:'GSW'},dpoy:{playerId:'Opponent',teamId:'BOS'}}} as FranchiseHistoryRecord });
describe('earned honors and lineup inspection',()=>{
 it('excludes imported banners and other teams awards; opens the exact earned season',()=>{
  const seasons=[season('2016',true),season('2026')];
  const honors=earnedHonors(seasons,'GSW');
  expect(honors.map(x=>x.award)).toEqual(['champion','mvp','fmvp']);
  expect(honors.every(x=>x.season==='2026')).toBe(true);
  const onSeason=vi.fn();render(<EarnedTrophyRoom seasons={seasons} teamId="GSW" identity={resolveTeamIdentity({teamId:'GSW',name:'Golden State'})} onSeason={onSeason}/>);
  fireEvent.click(screen.getByRole('button',{name:/Most Valuable Player,/}));
  expect(onSeason).toHaveBeenCalledWith('2026');
 });
 it('shows no unearned trophies in an empty save',()=>{
  render(<EarnedTrophyRoom seasons={[]} teamId="GSW" identity={resolveTeamIdentity({teamId:'GSW',name:'Golden State'})} onSeason={vi.fn()}/>);
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText('The first shelf is yours to fill.')).toBeTruthy();
 });
 it('filters actual links by selected starter or reserve, without inventing bonds',()=>{
  const players=[{id:'A',name:'Curry',pos:'PG'},{id:'B',name:'Green',pos:'PF'}];
  const {container}=render(<LineupBoard players={players} bench={[{id:'C',name:'Bench guard',pos:'SG'}]} bonds={[{label:'On-court duo',cards:['A','B'],bonus:2},{label:'Reserve connection',cards:['A','C'],bonus:1},{label:'Absent player',cards:['B','missing'],bonus:5}]}/>);
  expect(container.querySelectorAll('.lineup-link-lines .link-shadow')).toHaveLength(1);
  expect(screen.queryByText('Absent player')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:/6TH MAN/}));
  expect(screen.queryByText('On-court duo')).toBeNull();
  expect(container.querySelectorAll('.lineup-link-lines .link-shadow')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'Show all links'}));
  expect(container.querySelectorAll('.lineup-link-lines .link-shadow')).toHaveLength(1);
 });
 it('boss introductions use the real available opponent rotation',async()=>{
  const h=await loadHistoryForTests();const run=draftBest(h,newRun(h,42));
  run.seriesIndex=run.series.findIndex(s=>s.kind==='boss');
  const team=huntTeams(h).find(t=>t.id===run.series[run.seriesIndex].teamId)!;
  const pool=cardPool(h), mine=new Set(run.squad.map(id=>pool.byId.get(id)!.playerId));
  const expected=team.roster.map(id=>pool.byId.get(id)!).filter(c=>c&&!mine.has(c.playerId)).slice(0,6);
  expect(bossRoster(h,run).cards.map(c=>c.id)).toEqual(expected.map(c=>c.id));
 });
});
