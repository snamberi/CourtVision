import { beforeAll, describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason, type League } from '../simulation/league';
import { computeSeasonAwards } from '../simulation/awards';
import { awardDefinitions, defaultAward, saveAwardDefinition, editAwardHistory, exportAwardPack, parseAwardPack, importAwardPack, rankAward, resetAwardDefinition, awardLeagueForGames50 } from '../simulation/awardStudio';
import { getPlayerAwardsHistory } from '../simulation/leagueAnalytics';
import { currentSeasonAdvanced } from '../simulation/advancedStats';
import { beginNewSeasonRoster } from '../simulation/seasonTransition';
import { periodHonors } from '../simulation/awardRace';
import { buildSnapshot, parseUniverseFile } from '../storage/universeIO';
import { createSave, getSave, branchLeague50, deleteSave } from '../storage/saves';
import { newCareerMeta, isSandboxCareer, isUnrankedCareer } from '../career/career';
import { branchCareer50, saveCareer, listCareers, loadWorld, deleteCareer } from '../career/storage';
import { CATEGORIES, categoryValues } from '../career/categories';
import { startProgress, type Prime } from '../career/create';
import { stories50, recordTrade50, recordDraft50, tradeTree50, seasonDuos50, makePromise50, settlePromises50, retiredCoach50, inviteRetiredCoach50, formerPlayers50 } from '../simulation/leagueStories50';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { simulateGame } from '../simulation/engine/game';
import { liveBoxScore } from '../simulation/liveBox';
import { turningPoints50, liveRecordChases50, recordTargets50 } from '../simulation/replayStories50';
import { initialRotation50, lineupTestGame50 } from '../simulation/lineupTest50';
import { moraleContractAdjustment } from '../simulation/personality';
import { resolveTeamIdentity } from '../simulation/teamIdentity';
import { noteRelicFeat50, mastered50 } from '../relics/mastery50';
import { RELICS, mergeRelics, totalLuck, type RelicState } from '../relics/relics';
import type { GMLeagueExtras, TradeProposal } from '../simulation/gm';
import { TROPHY_ORDER } from '../simulation/trophies';

let season: League, extras: GMLeagueExtras;
beforeAll(() => {
  const generated = generateFullLeague(5050, 4, 8, 4, '2026', { priorSeasons: false });
  extras = generated.extras;
  season = simulateRemainingSeason({ ...generated.league, settings: { ...generated.league.settings, sandboxMode: true, injuriesEnabled: false } }, 50);
}, 60000);
const win = (l: League, team=0, player=0) => ({ playerId: l.teams[team].seasons[player].playerId, teamId:l.teams[team].teamId, teamName:l.teams[team].name, score:50 });

describe('Sandbox award creation and full history', () => {
  it('offers every built-in award and keeps all default results unchanged', () => {
    expect(awardDefinitions(season).map(d=>d.id)).toEqual(TROPHY_ORDER);
    const original=computeSeasonAwards(season);
    expect(computeSeasonAwards({ ...season, awardStudio: { definitions:[],history:{} } })).toEqual(original);
    expect(()=>saveAwardDefinition({ ...season, settings:{...season.settings,sandboxMode:false}},defaultAward('mvp'))).toThrow(/Sandbox/);
  });
  it('chooses Win Shares winners using the real advanced-stat calculation', () => {
    const d={...defaultAward('mvp'),name:'Impact King',method:'formula' as const,weights:{ws:1}};
    const l=saveAwardDefinition(season,d),rank=currentSeasonAdvanced(season);
    const max=Math.max(...[...rank.values()].map(s=>s.ws));
    const awards=computeSeasonAwards(l);
    expect(awards.mvp).not.toBeNull();
    expect(rank.get(awards.mvp!.playerId)!.ws).toBeCloseTo(max);
    expect(awards.votes?.mvp).toBeUndefined();
  });
  it('supports AND/OR eligibility, negative weights, multiple winners and lowest scores', () => {
    const d={...defaultAward('award_test'),weights:{ppg:1,tovPg:-1},order:'lowest' as const,winners:3,conditions:[{metric:'ppg' as const,op:'gte' as const,value:0},{metric:'ppg' as const,op:'gte' as const,value:1000}]};
    expect(rankAward(season,d)).toEqual([]);
    const l=saveAwardDefinition(season,{...d,conditionMode:'any'}),w=computeSeasonAwards(l).custom!.award_test;
    expect(w).toHaveLength(3); expect(w[0].score).toBeLessThanOrEqual(w[1].score);
  });
  it('edits or clears every award in any year and preserves unrelated legacy headlines', () => {
    let l={...season,franchiseHistory:[{season:'1970',championTeamId:null,championTeamName:null,mvpPlayerId:'Original MVP',mvpTeamName:'Old Team',dpoyPlayerId:null,royPlayerId:null,fmvpPlayerId:null}]} as League;
    l=editAwardHistory(l,'1970','dunk',[win(l)]);
    expect(l.franchiseHistory![0].mvpPlayerId).toBe('Original MVP');
    for (const id of TROPHY_ORDER) {
      const d=defaultAward(id),entry=d.kind==='team'?{...win(l),playerId:l.teams[0].teamId}:win(l);
      l=editAwardHistory(l,'1971',id,[entry]);
      expect(l.awardStudio!.history['1971'][id]).toHaveLength(1);
      if (d.kind==='player') expect(getPlayerAwardsHistory(l,entry.playerId).some(a=>a.season==='1971'&&a.key===id)).toBe(true);
      l=editAwardHistory(l,'1971',id,[]);
      expect(l.franchiseHistory!.find(r=>r.season==='1971')!.fullAwards!.custom![id]).toEqual([]);
      if (d.kind==='player') expect(getPlayerAwardsHistory(l,entry.playerId).some(a=>a.season==='1971'&&a.key===id)).toBe(false);
    }
  });
  it('replaces monthly and weekly winners without retaining stale honors', () => {
    let l=editAwardHistory(season,'2020','pom',[{...win(season),period:'November'},{...win(season),period:'December'}]);
    l=editAwardHistory(l,'2020','pow',[{...win(l,1),period:'Week 2'}]);
    expect(getPlayerAwardsHistory(l,win(l).playerId).filter(a=>a.key==='pom')).toHaveLength(2);
    l=editAwardHistory(l,'2020','pom',[{...win(l,1),period:'November'}]);
    expect(getPlayerAwardsHistory(l,win(l).playerId).filter(a=>a.key==='pom')).toEqual([]);
    expect(l.franchiseHistory!.find(r=>r.season==='2020')!.fullAwards!.honors).toHaveLength(2);
  });
  it('uses edited weekly formulas within the actual period', () => {
    const l=saveAwardDefinition(season,{...defaultAward('pow'),method:'formula',weights:{ast:1}});
    const honor=periodHonors(l,'week','Week 1','','',0,0);
    const window=awardLeagueForGames50(l,l.schedule.filter(g=>g.round===0&&g.result).map(g=>g.result!));
    expect(honor.length).toBeGreaterThan(0);
    for (const h of honor) {
      const pool={...window,teams:window.teams.filter(t=>!h.conference||t.conferenceId===h.conference)};
      const wanted=rankAward(pool,{...defaultAward('pow'),method:'formula',weights:{ast:1}})[0];
      expect(h.playerId).toBe(wanted?.playerId);
    }
  });
  it('keeps images and formulas scoped to one league, across packs and whole-league exports', () => {
    const image='data:image/png;base64,iVBORw0KGgo=';
    const l=saveAwardDefinition(season,{...defaultAward('award_impact'),name:'Impact Award',image,weights:{ws:3,apg:1}});
    const pack=parseAwardPack(JSON.stringify(exportAwardPack(l,['award_impact'])));
    const imported=importAwardPack(season,pack,true);
    expect(imported.awardStudio!.definitions[0].image).toBe(image);
    expect(season.awardStudio).toBeUndefined();
    expect(parseUniverseFile(JSON.stringify(buildSnapshot(imported,extras))).league.awardStudio).toEqual(imported.awardStudio);
    expect(()=>parseAwardPack(JSON.stringify({...pack,definitions:[{...pack.definitions[0],image:'https://tracker.invalid/img'}]}))).toThrow(/artwork/);
    expect(()=>parseAwardPack(JSON.stringify({...pack,definitions:[{...pack.definitions[0],id:'__proto__'}]}))).toThrow(/ID/);
  });
  it('archives custom awards, renames career trophies, and removes deleted custom history', () => {
    let l=saveAwardDefinition(season,{...defaultAward('award_playmaker'),name:'Passing Crown',weights:{apg:1},prestige:12});
    l=editAwardHistory(l,'2026','award_playmaker',[win(l)]);
    const next=beginNewSeasonRoster(l,extras,500).league;
    expect(next.franchiseHistory!.find(r=>r.season==='2026')!.fullAwards!.custom!.award_playmaker[0].playerId).toBe(win(l).playerId);
    expect(getPlayerAwardsHistory(next,win(l).playerId).some(a=>a.label==='Passing Crown')).toBe(true);
    const removed=resetAwardDefinition(next,'award_playmaker');
    expect(getPlayerAwardsHistory(removed,win(l).playerId).some(a=>a.key==='award_playmaker')).toBe(false);
  });
});

describe('league memory and choices', () => {
  it('follows a traded pick through a protected rollover, draft and later player trade', () => {
    const [a,b,c]=season.teams,player=a.seasons[0].playerId;
    const p:TradeProposal={teamAId:a.teamId,teamBId:b.teamId,playersFromA:[],playersFromB:[],picksFromA:['2027-R1-'+a.teamId]};
    let l=recordTrade50(season,season,extras,p);
    const receipt=stories50(l).trades[0];
    l={...l,stories50:{...stories50(l),pickRollovers:[{from:'2027-R1-'+a.teamId,to:'2028-R1-'+a.teamId,owner:b.teamId,note:'Protection rolled.'}]}};
    const prospect=extras.draftClass[0];
    l=recordDraft50(l,l,{...extras,draftAssetIds:{0:'2028-R1-'+a.teamId}},prospect,player,b.teamId,0);
    l=recordTrade50(l,l,extras,{teamAId:b.teamId,teamBId:c.teamId,playersFromA:[player],playersFromB:[c.seasons[0].playerId]});
    const tree=tradeTree50(l,receipt,b.teamId);
    expect(tree[0].drafted?.playerId).toBe(player);
    expect(tree[0].note).toContain('Protection');
    expect(tree[0].children[0].asset.id).toBe(c.seasons[0].playerId);
    expect(stories50(l).drafts[0].report).toHaveProperty('strengths');
  });
  it('records duo appearances from real boxes and finds players after moving teams', () => {
    const duos=seasonDuos50(season),d=duos[0];expect(d.games).toBeGreaterThan(0);
    const actual=season.schedule.filter(g=>g.played&&g.result).filter(g=>[g.result!.homeBox,g.result!.awayBox].some(b=>b.teamId===d.teamId&&b.players[d.a]?.minutes>0&&b.players[d.b]?.minutes>0));
    expect(d.games).toBe(actual.length);
    const p={...season.teams[0].seasons[0],teamId:season.teams[1].teamId,draftTeamId:season.teams[0].teamId};
    const moved={...season,teams:season.teams.map((t,i)=>({...t,seasons:i===0?t.seasons.filter(s=>s.playerId!==p.playerId):i===1?[...t.seasons,p]:t.seasons}))};
    expect(formerPlayers50(moved,extras,season.teams[0].teamId).some(x=>x.player.playerId===p.playerId)).toBe(true);
  });
  it('settles promises and scopes contract trust to the front office that made them', () => {
    const game=structuredClone(season.schedule.find(g=>g.result)!.result!),t=season.teams.find(t=>t.teamId===game.homeTeamId)!,p=t.seasons[0];
    game.homeBox.players[p.playerId].minutes=30;
    let l=makePromise50(season,t.teamId,p.playerId,'starter',t.teamId);
    for(let i=0;i<10;i++) l=settlePromises50(l,game);
    const after=l.teams.find(t=>t.teamId===p.teamId)!.seasons.find(s=>s.playerId===p.playerId)!;
    expect(l.promises50![0].status).toBe('kept');expect(after.promiseTrust50).toBe(1);
    expect(moraleContractAdjustment(after,t.teamId,true).notes).toContain('front office kept its promises');
    expect(moraleContractAdjustment(after,'other',true).notes).not.toContain('front office kept its promises');
    expect(()=>makePromise50({...season,settings:{...season.settings,sandboxMode:false}},t.teamId,p.playerId,'starter','other')).toThrow(/own players/);
  });
  it('turns a retiree’s actual playing traits into a hireable coach, only once', () => {
    const p={...season.teams[0].seasons[0],age:38};
    const rec={playerId:p.playerId,finalAge:38,finalSeason:'2026',finalOverall:70,finalTeamId:season.teams[0].teamId,finalTeamName:season.teams[0].name,finalSeasonData:p};
    const coach=retiredCoach50(rec,'2027')!;expect(coach.formerPlayerId).toBe(p.playerId);expect(coach.age).toBe(39);
    const l=inviteRetiredCoach50({...season,retiredPlayers:[rec]},p.playerId);
    expect(l.staffMarket?.at(-1)?.coachId).toBe(p.playerId);
    expect(()=>inviteRetiredCoach50(l,p.playerId)).toThrow(/already/);
  });
});

describe('independent simulations and replays', () => {
  it('runs A and B on matching seeds without mutating live players or games', () => {
    const a=season.teams[0],b=season.teams[1],rotation=initialRotation50(a),original=JSON.stringify(season);
    const request={league:season,teamId:a.teamId,opponentId:b.teamId,a:rotation,b:rotation,games:2,seed:50};
    const first=lineupTestGame50(request,'a',0),second=lineupTestGame50(request,'b',0);
    expect(first).toEqual(second);expect(first.shotQuality).toBeGreaterThan(0);expect(first.endingFatigue).toBeGreaterThanOrEqual(0);expect(JSON.stringify(season)).toBe(original);
  });
  it('ends at the target score, honors a short shot clock and preserves box totals', () => {
    const game=simulateGame({home:season.teams[0],away:season.teams[1],settings:{...season.settings,seed:100,era:{...season.settings.era,shotClockSeconds:8}},rules:{...DEFAULT_LEAGUE_RULES,targetScore50:25}});
    expect(Math.max(game.homeScore,game.awayScore)).toBeGreaterThanOrEqual(25);
    expect(Math.max(game.homeScore,game.awayScore)).toBeLessThan(29);
    expect(game.possessionLog.slice(0,-1).every(e=>Math.max(e.homeScoreAfter,e.awayScoreAfter)<25)).toBe(true);
    expect(game.possessionLog.every(e=>(e.durationSeconds??0)<=8)).toBe(true);
    expect(Object.values(game.homeBox.players).reduce((n,p)=>n+p.points,0)).toBe(game.homeScore);
  });
  it('finds non-overlapping real scoring swings and never shows future record totals', () => {
    const game=season.schedule.find(g=>g.result)!.result!,points=turningPoints50(game);
    for(const p of points){const before=game.possessionLog[p.start-1],end=game.possessionLog[p.end];const h=end.homeScoreAfter-(before?.homeScoreAfter??0),a=end.awayScoreAfter-(before?.awayScoreAfter??0);expect(p.points-p.opponent).toBe(Math.abs(h-a));}
    const order={home:Object.keys(game.homeBox.players),away:Object.keys(game.awayBox.players)};
    const live=liveBoxScore(game.possessionLog,0,game.homeTeamId,game.awayTeamId,order);
    expect(liveRecordChases50([live.home,live.away],[{stat:'pts',value:25,holder:'Record Holder',scope:'league'}])).toEqual([]);
    expect(recordTargets50(season,season.teams.map(t=>t.teamId)).some(r=>r.scope==='franchise')).toBe(true);
  });
  it('stores league and career branches separately and keeps the originals ranked', async () => {
    const l={...season,settings:{...season.settings,sandboxMode:false}},id=await createSave('Original 50',l,extras,null);
    const branch=await branchLeague50('Test 50',l,extras,null),copy=await getSave(branch);
    expect(copy!.league.settings.sandboxMode).toBe(true);expect((await getSave(id))!.league.settings.sandboxMode).toBe(false);
    const p=l.teams[0].seasons[0],prime=Object.fromEntries(CATEGORIES.map(c=>[c.id,categoryValues(p,c.id)])) as Prime;
    const meta=newCareerMeta('branch-test-50',50,'wheel',{name:p.playerId,pos:'PG',jersey:1},prime,'balanced',p.playerId,'2026',startProgress());
    const world={id:meta.id,league:l,extras,phase:'inSeason' as const};await saveCareer(meta,world);
    const alternate=await branchCareer50(meta,world,'Stay loyal');
    expect(isSandboxCareer(alternate.meta)).toBe(true);expect(isUnrankedCareer(alternate.meta)).toBe(true);
    expect((await listCareers()).find(m=>m.id===meta.id)!.mode).toBe('wheel');expect((await loadWorld(alternate.meta.id))!.league.settings.sandboxMode).toBe(true);
    await deleteSave(id);await deleteSave(branch);await deleteCareer(meta.id);await deleteCareer(alternate.meta.id);
  });
});

describe('cosmetic mastery and home-court identity', () => {
  it('deduplicates finishes, merges progress and adds cosmetic rewards without changing luck', () => {
    const relic=RELICS.find(r=>r.rarity==='common')!;
    const base:RelicState={v:1,spins:0,coins:0,owned:{[relic.id]:1},secrets:[],granted:[],history:[],upgraded:[],equipped:[relic.id],slotsBought:0,pity:{epic:0,legendary:0,mythic:0,lucky:0},opens:0,ledger:[],rewards:[]};
    let s=noteRelicFeat50(base,RELICS,base.equipped,{run:'hunt:a'});s=noteRelicFeat50(s,RELICS,base.equipped,{run:'hunt:a'});expect(s.feats50![relic.id].runs).toHaveLength(1);
    s=noteRelicFeat50(s,RELICS,base.equipped,{run:'hunt:b'});s=noteRelicFeat50(s,RELICS,base.equipped,{run:'story:c'});
    const other=noteRelicFeat50(base,RELICS,base.equipped,{rareDraw:true});s=mergeRelics(s,other);
    expect(mastered50(s,relic)).toBe(true);expect(s.cosmetics).toContain(`mastery-title:${relic.name} Master`);expect(totalLuck(s)).toBe(totalLuck(base));expect(s.coins).toBe(0);
  });
  it('normalizes court colors, names and banner placement independently of character art', () => {
    const t=season.teams[0],identity={...resolveTeamIdentity(t),arenaName:'Snamberi Arena',baselineText:'NineFoldVision',centerMark:'initials' as const,bannerPlacement:'right' as const,courtApron:'#123456'};
    expect(resolveTeamIdentity({...t,identity})).toMatchObject(identity);
  });
});
