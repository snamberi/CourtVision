import { OccasionBanner } from './OccasionBanner';
import { HalftimeSpeech } from './HalftimeSpeech';
import { refCrew, type CoachLook } from '../visuals/coachLook';
import { TeamLink, TeamText } from './TeamLink';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameResult } from '../simulation/boxscore';
import type { PlayerSeason } from '../simulation/types';
import { hotHand, playbackClock, playbackForEntry, playbackScore } from '../simulation/gamePlayback';
import { courtFrame, courtShot, replayDuration, type CourtFrame } from '../simulation/courtMotion';
import type { PossessionLogEntry, PossessionPlayback } from '../simulation/boxscore';
import { PixelIcon } from './PixelIcon';
import { WatchCourt, type CourtCamera } from './WatchCourt';
import { detectHighlights, reelFor, formatGameClock, HIGHLIGHT_LABEL, HIGHLIGHT_MIN, type Highlight } from '../simulation/highlights';
import { liveBoxScore } from '../simulation/liveBox';
import { CourtAudio } from '../audio/courtAudio';
import { CoachPanel, HighlightsPanel, LiveBoxPanel, type CoachingProps } from './WatchPanels';
import { currentRun, lastShotMoment, crunchMoment, crunchStart } from '../simulation/coachMoments';
import { canRecordReel, startReelRecording, type ReelRecording } from './reelRecorder';
import type { ClipWriter } from '../share/clipGif';
import { track } from '../analytics/track';

const CLIP_FPS=12;

const THREES=['corner3','aboveBreak3','pullUp3','catchAndShoot3','stepback'];
/** Broadcast-style call for the current phase. Names come only from the recorded possession. */
function liveCall(frame:CourtFrame,play:PossessionPlayback,entry:PossessionLogEntry):string{
  const shooter=play.shooterId??entry.ballHandlerId,handler=play.passerId??entry.ballHandlerId,three=THREES.includes(play.shotType??'');
  const ph=frame.phase;
  const timeout=entry.events.find(e=>e.endsWith(' timeout'));
  if(timeout&&ph==='Bring it up')return `TIMEOUT — ${timeout.replace(' timeout','')} huddles up.`;
  if(ph.startsWith('Free throw'))return `${shooter} at the line · ${ph.replace('Free throw ','').replace(' of ','/')}`;
  switch(ph){
    case 'Bring it up':return `${handler} brings it up the floor.`;
    case 'Second chance':return `Second chance! ${handler} resets it after the offensive board.`;
    case 'Pick and roll':return `${handler} comes off the ball screen…`;
    case 'Pass':case 'Bounce pass':return `${play.passerId} finds ${play.shooterId}.`;
    case 'Drive & gather':return `${shooter} attacks the basket…`;
    case 'Set for the shot':return `${shooter} squares up…`;
    case 'Three-point attempt':return `${shooter} fires ${play.shotType==='corner3'?'from the corner':'from deep'}…`;
    case 'Shot in the air':return `${shooter} lets it go…`;
    case 'At the rim':return `${shooter} takes flight!`;
    case 'Blocked':return `REJECTED! ${play.blockerId} sends it away.`;
    case 'Basket':return three?`BANG! ${shooter} buries the three.`:`${shooter} scores.`;
    case 'Dunk!':return `${shooter} throws it DOWN!`;
    case 'Off the rim':return `${shooter}'s shot is no good.`;
    case 'Rebound':return entry.debug?.offensiveRebound===true?`${play.rebounderId} crashes the offensive glass!`:`${play.rebounderId} cleans up the glass.`;
    case 'Loose ball':return 'Loose ball on the floor!';
    case 'Steal':case 'Breakaway':return `${play.stealerId} picks it off and he's gone!`;
    case 'Turnover':return `Turnover — ${handler} gives it away.`;
    case 'Whistle':return `Whistle! ${shooter} is fouled.`;
    case 'Inbound':return 'Ball inbounded.';
    case 'Outlet':return 'Outlet pass, pushing the other way.';
    case 'Keep possession':return 'Second chance — they keep it.';
    default:return `${frame.carrier??shooter} · ${ph}`;
  }
}
/** Current unanswered scoring run among revealed possessions only (no spoilers). */
function scoringRun(log:PossessionLogEntry[],completed:number):{home:boolean;points:number}|null{
  let home=0,away=0;
  for(let i=completed-1;i>=0;i--){const prev=log[i-1],h=log[i].homeScoreAfter-(prev?.homeScoreAfter??0),a=log[i].awayScoreAfter-(prev?.awayScoreAfter??0);
    if(h>0&&away>0||a>0&&home>0)break;home+=h;away+=a;}
  const points=Math.max(home,away);return points>=7?{home:home>away,points}:null;
}
const GameFlow=memo(function GameFlow({log,completed,total,onSeek,homeName,awayName,markers}:{log:PossessionLogEntry[];completed:number;total:number;onSeek:(v:number)=>void;homeName:string;awayName:string;markers:Highlight[]}){
  const shown=log.slice(0,completed),max=Math.max(8,...shown.map(e=>Math.abs(e.homeScoreAfter-e.awayScoreAfter)));
  const x=(i:number)=>(i/Math.max(1,total))*1000,y=(m:number)=>30-m/max*26;
  const d=shown.length?`M0 30${shown.map((e,i)=>`L${x(i+1).toFixed(1)} ${y(e.homeScoreAfter-e.awayScoreAfter).toFixed(1)}`).join('')}`:'';
  const quarters=shown.map((e,i)=>i>0&&e.quarter!==shown[i-1].quarter?i:-1).filter(i=>i>0);
  return <div className="watch-flow"><div className="watch-flow-legend"><span>▲ {homeName}</span><span>GAME FLOW</span><span>▼ {awayName}</span></div>
    <svg viewBox="0 0 1000 60" preserveAspectRatio="none" role="img" aria-label="Score margin so far" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();onSeek(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*total);}}>
      <rect width="1000" height="60" fill="#0b1422"/><path d="M0 30H1000" stroke="#2a3546"/>
      {quarters.map(i=><path key={i} d={`M${x(i)} 0V60`} stroke="#2a3546" strokeDasharray="3 3"/>)}
      {d&&<><path d={`${d}L${x(completed)} 30Z`} fill="#f47b20" opacity=".18"/><path d={d} fill="none" stroke="#f47b20" strokeWidth="2" vectorEffect="non-scaling-stroke"/></>}
      {markers.map(h=><rect key={h.index} className={`flow-marker hl-${h.kind}`} x={x(h.index)-3} y={h.score>=7?1:4} width="6" height={h.score>=7?9:6} fill={h.score>=7?'#ffd166':'#f4f0e6'}><title>{HIGHLIGHT_LABEL[h.kind]}: {h.text}</title></rect>)}
      <path d={`M${x(completed)} 0V60`} stroke="#ffd166" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
    </svg></div>;
});

interface Props {
  game: GameResult;
  home: { teamId: string; name: string };
  away: { teamId: string; name: string };
  homeRoster?: PlayerSeason[];
  awayRoster?: PlayerSeason[];
  onBoxScore: () => void;
  /** Start at this possession (e.g. opened from a news highlight). */
  startAt?: number;
  /** Present only while the person is coaching this game live. */
  coaching?: CoachingProps;
  /** Rivalry between the two teams, if any: the crowd is louder and the broadcast says so. */
  rivalry?: { level: string; seriesText?: string } | null;
  /** A big game (playoffs, Game 7, the Cup final): the broadcast and the crowd rise to it. */
  occasion?: import('../simulation/bigGames').Occasion | null;
  crowdFill?: number;
  /** What the court shows beyond the game: the home arena's upgrades, Rivalry Week, strong duos. */
  court?: CourtExtras;
}
export interface CourtExtras { arena?: Partial<Record<'scoreboard'|'lights'|'crowd'|'mascot',number>>; rivalryWeek?: { hype: number } | null; duos?: Set<string>; coaches?: { home?: CoachLook; away?: CoachLook }; /** An owner's arena (Owner's Box): its name on the scorer's table, skyboxes up top. */ building?: { name: string; suites: number } }
const SOUND_KEY='cv-watch-sound';
const readSound=()=>{try{return localStorage.getItem(SOUND_KEY)==='on';}catch{return false;}};
const writeSound=(on:boolean)=>{try{localStorage.setItem(SOUND_KEY,on?'on':'off');}catch{/* private mode: keep the in-memory choice */}};
type Tab='box'|'coach'|'highlights';
/** Plays that get the big-moment camera, what the arena shouts, and the replay pace. */
const BIG_KINDS=new Set<Highlight['kind']>(['gameWinner','dunk','block','clutchThree','andOne']);
const BIG_CALL:Partial<Record<Highlight['kind'],string>>={gameWinner:'GAME-WINNER!',dunk:'SLAM!',block:'REJECTED!',clutchThree:'BANG!',andOne:'AND ONE!'};
const BIG_HIT_MS=1300,BIG_SLOW=.35;

export function WatchGame({game,home,away,homeRoster=[],awayRoster=[],onBoxScore,startAt,coaching,rivalry,occasion,crowdFill,court}:Props) {
  // The game's officiating crew: the same three for the same game.
  const crew=useMemo(()=>refCrew(game.seed??`${home.teamId}-${away.teamId}`),[game.seed,home.teamId,away.teamId]);
  const occasionBoost=occasion?({game7:.4,final:.32,cupFinal:.28,elimination:.25,playoff:.15,cup:.12} as const)[occasion.stakes]:0;
  const rivalryBoost=Math.min(.45,(rivalry?(rivalry.level==='Bitter rivals'?.3:rivalry.level==='Rivals'?.2:.12):0)+occasionBoost);
  const total=game.possessionLog.length;
  const [cursor,setCursor]=useState(()=>startAt!=null?Math.max(0,Math.min(total,startAt)):0);
  const [playing,setPlaying]=useState(()=>!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [labels,setLabels]=useState(true);
  const [trail,setTrail]=useState(false);
  const [shotChart,setShotChart]=useState(true);
  // The close camera that follows the ball is the default; a choice is remembered on this device.
  const [camera,setCameraState]=useState<CourtCamera>(()=>{try{const v=localStorage.getItem('cv-court-camera');return v==='full'||v==='broadcast'||v==='follow'?v:'follow';}catch{return 'follow';}});
  const setCamera=(c:CourtCamera)=>{setCameraState(c);try{localStorage.setItem('cv-court-camera',c);}catch{/* storage blocked */}};
  const [screenMessage,setScreenMessage]=useState('');
  const [tab,setTab]=useState<Tab>(coaching?.openCoach?'coach':'box');
  const [sound,setSound]=useState(false);
  const [soundNote,setSoundNote]=useState<string|null>(()=>readSound()?'Sound was on last time — press Sound to turn it back on.':null);
  const [isRecording,setIsRecording]=useState(false);
  const [reel,setReel]=useState<{plays:Highlight[];pos:number}|null>(null);
  const [shareStatus,setShareStatus]=useState<string|null>(null);
  const [videoStatus,setVideoStatus]=useState<string|null>(null);
  const recording=useRef<ReelRecording|null>(null);
  // Highlight clip (GIF): one possession drawn frame by frame on a hidden stage, then encoded.
  const [clip,setClip]=useState<{h:Highlight;step:number;steps:number;vertical?:boolean}|null>(null);
  const [clipOut,setClipOut]=useState<{blob:Blob;url:string;name:string;text:string}|null>(null);
  const [clipStatus,setClipStatus]=useState<string|null>(null);
  const clipWriter=useRef<ClipWriter|null>(null);
  const clipStage=useRef<HTMLDivElement>(null);
  const screen=useRef<HTMLElement>(null);
  const arena=useRef<HTMLDivElement>(null);
  const audio=useRef<CourtAudio|null>(null);
  const [speed,setSpeed]=useState(1);
  // Big-moment camera: a dunk, block or game-winner gets a zoom and a crowd flash, then a slow-motion replay.
  const [bigCam,setBigCam]=useState(()=>!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [bigmo,setBigmo]=useState<{h:Highlight;phase:'hit'|'replay'}|null>(null);
  const bigSeen=useRef(new Set<number>());
  const finished=cursor>=total;
  const index=Math.min(Math.floor(cursor),Math.max(0,total-1));
  const progress=finished?1:cursor-index;
  const completed=finished?total:index;
  const entry=game.possessionLog[index];
  const regulation=game.regulationPeriods??4;
  const play=useMemo(()=>entry?playbackForEntry(entry):{},[entry]);
  const frame=useMemo(()=>entry?courtFrame(entry,progress,home.teamId,away.teamId,regulation,game.possessionLog[index-1]):null,[entry,progress,home.teamId,away.teamId,regulation,game,index]);
  const durations=useMemo(()=>game.possessionLog.map(replayDuration),[game]);
  const score=playbackScore(game,completed);
  const hot=useMemo(()=>hotHand(game,completed),[game,completed]);
  const allShots=useMemo(()=>game.possessionLog.map(e=>courtShot(e,home.teamId,regulation)),[game,home.teamId,regulation]);
  const shots=useMemo(()=>shotChart?allShots.slice(0,completed).filter(s=>s!==null):[],[allShots,completed,shotChart]);
  const ghosts=useMemo(()=>trail&&entry?[1,2,3,4].map(k=>progress-k*.012).filter(v=>v>=0).map(v=>courtFrame(entry,v,home.teamId,away.teamId,regulation,game.possessionLog[index-1]).ball):[],[trail,entry,progress,home.teamId,away.teamId,regulation,game,index]);
  const run=useMemo(()=>scoringRun(game.possessionLog,completed),[game,completed]);
  const shotClock=useMemo(()=>{if(!entry||finished||frame?.phase.startsWith('Free throw'))return undefined;const next=game.possessionLog[index+1];const dur=entry.durationSeconds??(next?.quarter===entry.quarter?Math.max(0,entry.clockSeconds-next.clockSeconds):Math.min(24,entry.clockSeconds));return Math.max(0,Math.min(24,Math.ceil(24-dur*progress)));},[entry,finished,frame,game,index,progress]);
  const rosters=useMemo(()=>[...homeRoster,...awayRoster],[homeRoster,awayRoster]);
  const highlights=useMemo(()=>detectHighlights(game.possessionLog,regulation),[game,regulation]);
  const reelPlays=useMemo(()=>reelFor(highlights,i=>durations[i]*.9),[highlights,durations]);
  const markers=useMemo(()=>highlights.filter(h=>h.index<completed&&h.score>=HIGHLIGHT_MIN),[highlights,completed]);
  const bigMoments=useMemo(()=>new Map(highlights.filter(h=>BIG_KINDS.has(h.kind)&&h.score>=HIGHLIGHT_MIN).map(h=>[h.index,h])),[highlights]);
  const bigNow=bigCam&&playing&&!reel&&!bigmo&&progress>=.72?bigMoments.get(index):undefined;
  useEffect(()=>{
    if(!bigNow||bigSeen.current.has(bigNow.index))return;
    bigSeen.current.add(bigNow.index);
    const h=bigNow;
    const a=setTimeout(()=>setBigmo({h,phase:'hit'}),0);
    return()=>clearTimeout(a);
  },[bigNow]);
  // After the zoom, rewind to the start of the move and play it again slowly.
  useEffect(()=>{
    if(bigmo?.phase!=='hit')return;
    const h=bigmo.h;
    const t=setTimeout(()=>{setBigmo(m=>m&&m.h===h?{h,phase:'replay'}:m);setCursor(h.index+.3);},BIG_HIT_MS);
    return()=>clearTimeout(t);
  },[bigmo]);
  useEffect(()=>{if(bigmo?.phase==='replay'&&(index>bigmo.h.index||finished)){const t=setTimeout(()=>setBigmo(null),0);return()=>clearTimeout(t);}},[bigmo,index,finished]);
  const rosterOrder=useMemo(()=>({home:Object.keys(game.homeBox.players),away:Object.keys(game.awayBox.players)}),[game]);
  const live=useMemo(()=>liveBoxScore(game.possessionLog,completed,home.teamId,away.teamId,rosterOrder),[game,completed,home.teamId,away.teamId,rosterOrder]);
  const clockLabel=finished?'FINAL':playbackClock(game,index,progress);

  useEffect(()=>{
    if (!playing || finished) return;
    let frame=0,last=0;
    const slow=bigmo?.phase==='replay'?BIG_SLOW:1;const tick=(now:number)=>{const elapsed=last?Math.min(100,now-last)*speed*slow:0;if(elapsed) setCursor(c=>{let remaining=elapsed;let next=c;while(remaining>0&&next<total){const i=Math.floor(next),duration=durations[i],available=(1-(next-i))*duration;if(remaining>=available){next=i+1;remaining-=available;}else {next+=remaining/duration;remaining=0;}}return Math.min(total,next);});last=now;frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(frame);
  },[playing,finished,speed,total,durations,bigmo?.phase]);
  useEffect(()=>{const hide=()=>{if(document.hidden)setPlaying(false);};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);

  // Highlight reel: play each chosen possession, then cut straight to the next one.
  const stopRecording=useCallback(async()=>{
    const rec=recording.current;if(!rec)return;recording.current=null;setIsRecording(false);
    const blob=await rec.stop();
    const file=new File([blob],'courtvision-highlights.webm',{type:'video/webm'});
    const nav=navigator as Navigator&{canShare?:(d:ShareData)=>boolean};
    if(nav.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:`${home.name} vs ${away.name} highlights`});setVideoStatus('Video shared.');return;}catch{/* fall back to a download */}}
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
    setVideoStatus(`Saved courtvision-highlights.webm (${(blob.size/1e6).toFixed(1)} MB).`);
  },[home.name,away.name]);
  useEffect(()=>{
    if(!reel)return;
    const current=reel.plays[reel.pos];
    if(!current){setReel(null);if(recording.current)void stopRecording();return;}
    if(cursor>=current.index+1){
      const next=reel.plays[reel.pos+1];
      if(next){setReel({...reel,pos:reel.pos+1});setCursor(next.index+.08);}
      else{setReel(null);setPlaying(false);setCursor(total);if(recording.current)void stopRecording();}
    }
  },[cursor,reel,total,stopRecording]);
  const startReel=()=>{if(!reelPlays.length)return;setReel({plays:reelPlays,pos:0});setCursor(reelPlays[0].index+.08);setSpeed(1);setPlaying(true);};
  const shareText=()=>{
    const lines=reelPlays.map(h=>`• ${formatGameClock(h.quarter,h.clockSeconds,regulation)} — ${h.text} (${h.homeScoreAfter}–${h.awayScoreAfter})`);
    return `${home.name} ${game.homeScore}, ${away.name} ${game.awayScore} — Court Vision highlights\n${lines.join('\n')}`;
  };
  const share=async()=>{
    const text=shareText();
    try{if(navigator.share){await navigator.share({title:'Court Vision highlights',text});setShareStatus('Shared.');return;}}catch{/* cancelled or unsupported: fall back to the clipboard */}
    try{await navigator.clipboard.writeText(text);setShareStatus('Highlights copied — paste them anywhere.');}catch{setShareStatus(text);}
  };
  const recordVideo=async()=>{
    if(!arena.current||!canRecordReel()){setVideoStatus('Video recording is not supported in this browser.');return;}
    setCamera('full');
    try{recording.current=startReelRecording(arena.current,audio.current?.stream());setIsRecording(true);}catch{setVideoStatus('This browser could not start a recording.');return;}
    setVideoStatus('Recording the reel… keep this tab open (about a minute).');
    startReel();
  };
  useEffect(()=>()=>{void recording.current?.stop();recording.current=null;},[]);

  // Sound: off by default; the choice is remembered on this device. Needs a click to start audio.
  const toggleSound=async()=>{
    if(sound){setSound(false);writeSound(false);await audio.current?.disable();return;}
    audio.current??=new CourtAudio();
    const ok=await audio.current.enable();
    setSound(ok);writeSound(ok);setSoundNote(ok?null:'Sound is not available in this browser.');
  };
  useEffect(()=>()=>audio.current?.dispose(),[]);
  const prev=useRef<{index:number;net:number;rim:number;z:number;phase:string;callout?:string;quarter:number}|null>(null);
  useEffect(()=>{
    const a=audio.current,f=frame;
    if(!sound||!a||!f||!entry){prev.current=null;return;}
    const p=prev.current,active=playing&&!finished;
    const offenseHome=f.offenseTeamId===home.teamId;
    if(active&&p){
      if(speed<=2&&f.carrier&&f.ball.z<6&&p.z>=6&&p.index===index)a.dribble();
      if(f.net>0&&p.net===0)a.swish();
      if(f.net>0&&p.net===0&&f.callout?.tone==='make'){if(f.callout.text==='SLAM!')a.dunk(offenseHome);else if(f.callout.text==='+3')a.pop(offenseHome);else a.cheer(offenseHome);}
      if((f.rim??0)>0&&p.rim===0)a.rim();
      if(f.callout?.tone==='defense'&&p.callout!==f.callout.text)a.cheer(!offenseHome);
      if((f.phase==='Whistle'&&p.phase!=='Whistle')||(f.phase.startsWith('Free throw 1')&&!p.phase.startsWith('Free throw')&&entry.result!=='FOUL'))a.whistle();
      if(entry.quarter!==p.quarter)a.buzzer();
      if(index!==p.index&&entry.events.some(e=>e.endsWith(' timeout')))a.whistle();
    }
    const margin=Math.abs(score.home-score.away),late=entry.quarter>=regulation;
    a.crowd(finished?.15+rivalryBoost/2:Math.min(1,.2+rivalryBoost+(margin<=5?.25:margin<=10?.1:0)+(late?.25:0)+(f.callout?.tone==='make'&&offenseHome?.3:0)));
    prev.current={index,net:f.net,rim:f.rim??0,z:f.ball.z,phase:f.phase,callout:f.callout?.text,quarter:entry.quarter};
  },[frame,sound,playing,finished,speed,index,entry,home.teamId,score.home,score.away,regulation,rivalryBoost]);
  const wasFinished=useRef(finished);
  useEffect(()=>{if(finished&&!wasFinished.current&&sound)audio.current?.buzzer();wasFinished.current=finished;},[finished,sound]);

  const makeClip=async(h:Highlight,vertical=false)=>{
    if(clip)return;
    setPlaying(false);setReel(null);setClipStatus(vertical?'Making the TikTok clip…':'Making the clip…');
    try{const m=await import('../share/clipGif');const {siteHost}=await import('../share/shareCard');try{await document.fonts.ready;}catch{/* system fonts */}
      clipWriter.current=m.startClip(undefined,vertical?{vertical:true,caption:h.text,sub:`${home.name} ${h.homeScoreAfter}–${h.awayScoreAfter} ${away.name}`,site:siteHost()}:undefined);
      setClip({h,step:0,steps:Math.max(24,Math.ceil(durations[h.index]/1000*CLIP_FPS)),vertical});}
    catch{setClipStatus('This browser could not make a clip.');}
  };
  const clipEntry=clip?game.possessionLog[clip.h.index]:undefined;
  const clipProgress=clip?Math.min(1,clip.step/(clip.steps-1)):0;
  const clipFrame=useMemo(()=>clip&&clipEntry?courtFrame(clipEntry,clipProgress,home.teamId,away.teamId,regulation,game.possessionLog[clip.h.index-1]):null,[clip,clipEntry,clipProgress,home.teamId,away.teamId,regulation,game]);
  useEffect(()=>{
    if(!clip||!clipWriter.current||!clipStage.current)return;
    let live=true;
    const holdFrames=Math.round(CLIP_FPS*1.2);
    clipWriter.current.add(clipStage.current,1000/CLIP_FPS).then(()=>{
      if(!live)return;
      if(clip.step+1<clip.steps+holdFrames){setClip({...clip,step:clip.step+1});setClipStatus(`Making the clip… ${Math.round((clip.step+1)/(clip.steps+holdFrames)*100)}%`);return;}
      const blob=clipWriter.current!.finish();clipWriter.current=null;
      const h=clip.h,when=formatGameClock(h.quarter,h.clockSeconds,regulation);
      setClipOut({blob,url:URL.createObjectURL(blob),name:`${home.name}-${away.name}-${h.kind}${clip.vertical?'-tiktok':''}.gif`.replace(/[^\w.-]+/g,'-').toLowerCase(),text:`${h.text} (${when}, ${home.name} ${h.homeScoreAfter}–${h.awayScoreAfter} ${away.name}) · Court Vision`});
      setClip(null);setClipStatus(null);
      track('clip',{kind:h.kind,kb:Math.round(blob.size/1024)});
    }).catch(()=>{if(live){setClip(null);clipWriter.current=null;setClipStatus('This browser could not make a clip.');}});
    return()=>{live=false;};
  },[clip]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>()=>{if(clipOut)URL.revokeObjectURL(clipOut.url);},[clipOut]);
  const saveClip=async(how:'share'|'download')=>{
    if(!clipOut)return;
    const {shareImage}=await import('../share/shareCard');
    try{const r=await shareImage(clipOut.blob,clipOut.name,clipOut.text,how);setClipStatus(r==='shared'?'Shared!':'Clip saved.');}catch{setClipStatus('Sharing was cancelled.');}
  };
  const seek=useCallback((v:number)=>{setPlaying(false);setReel(null);setBigmo(null);setCursor(Math.min(total,v));},[total]);
  const nextHighlight=highlights.find(h=>h.index>index&&h.score>=HIGHLIGHT_MIN);
  const jumpTo=(h:Highlight)=>{setReel(null);setBigmo(null);setCursor(h.index+.02);setPlaying(true);};
  const reelNow=reel?reel.plays[reel.pos]:null;
  const commentary=finished?'Final buzzer. The game is in the books.':progress>=.98?entry?.events.filter(e=>!e.endsWith(' has the ball')&&!e.startsWith('Action:')&&!e.endsWith(' timeout')).join(' · '):frame&&entry?liveCall(frame,play,entry):'Ready';
  const coachAt=finished?total:progress===0?index:index+1;
  const theirTeam=coaching?(coaching.teamId===home.teamId?live.away:live.home):null;
  const coachRun=useMemo(()=>currentRun(game.possessionLog,coachAt),[game,coachAt]);
  const lastShotNow=!!coaching&&!finished&&lastShotMoment(game.possessionLog,coachAt,coaching.teamId,home.teamId,regulation);
  // Play it yourself: in crunch time (last 2:00, within 8) the tape stops on every one of your trips for a play call.
  const [callPlays,setCallPlays]=useState(true);
  const crunchNow=!!coaching&&callPlays&&!finished&&!lastShotNow&&crunchMoment(game.possessionLog,coachAt,coaching.teamId,regulation);
  const crunchAt=useMemo(()=>crunchStart(game.possessionLog,regulation),[game,regulation]);
  // Game on the line: stop the tape once and hand the coach the clipboard.
  const prompted=useRef(-1);
  useEffect(()=>{if((lastShotNow||crunchNow)&&prompted.current!==coachAt){prompted.current=coachAt;setPlaying(false);setReel(null);setTab('coach');}},[lastShotNow,crunchNow,coachAt]);
  const myTeam=coaching?(coaching.teamId===home.teamId?live.home:live.away):null;
  // Halftime: when you're coaching, the tape stops at the start of the third quarter for the locker-room speech.
  const halfAt=useMemo(()=>game.possessionLog.findIndex(e=>e.quarter>regulation/2),[game,regulation]);
  const spoke=!!coaching?.commands.some(c=>c.kind==='speech'&&c.teamId===coaching.teamId);
  const [halftimeOpen,setHalftimeOpen]=useState(false);
  const halftimeShown=useRef(false);
  useEffect(()=>{if(coaching&&!spoke&&!finished&&halfAt>0&&index===halfAt&&progress<.05&&!halftimeShown.current){halftimeShown.current=true;setPlaying(false);setReel(null);setHalftimeOpen(true);}},[coaching,spoke,finished,halfAt,index,progress]);
  const myMargin=coaching?(coaching.teamId===home.teamId?score.home-score.away:score.away-score.home):0;
  const starters=useMemo(()=>{const first=game.possessionLog[0];return coaching&&first?(coaching.teamId===home.teamId?first.onCourtHome:first.onCourtAway):[];},[game,coaching,home.teamId]);
  return <section ref={screen} className="watch-game" aria-label="Watch Game" tabIndex={0} onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.code==='Space'){e.preventDefault();if(!finished)setPlaying(p=>!p);}if(e.code==='ArrowRight'){e.preventDefault();setPlaying(false);setCursor(c=>Math.min(total,Math.floor(c)+1));}if(e.code==='ArrowLeft'){e.preventDefault();setPlaying(false);setCursor(c=>Math.max(0,Math.floor(c)-1));}}}>
    {occasion&&(occasion.stakes==='game7'||occasion.stakes==='final'||occasion.stakes==='cupFinal')&&<OccasionBanner occasion={occasion} />}<div className="watch-heading"><div><span className="pixel-eyebrow">{occasion?occasion.eyebrow:coaching?'COURTSIDE / COACHING LIVE':'COURTSIDE / POSSESSION REPLAY'}</span><h2>{occasion?occasion.title:'Watch Game'}</h2></div>{court?.rivalryWeek?<span className="watch-rivalry watch-rivalry-week" title={rivalry?.seriesText}><PixelIcon name="flame" size={14}/> RIVALRY WEEK · HYPE {court.rivalryWeek.hype}</span>:rivalry&&<span className="watch-rivalry" title={rivalry.seriesText}><PixelIcon name="flame" size={14}/> RIVALRY · {rivalry.level.toUpperCase()}</span>}<span className="watch-status">{reel?'HIGHLIGHTS':finished?'FINAL':playing?'PLAYING':'PAUSED'}</span></div>
    <div className="watch-live-header"><div className="watch-controls"><button className="primary" disabled={finished} onClick={()=>setPlaying(p=>!p)}>{playing&&!finished?'Pause':'Play'}</button><label>Speed<select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(+e.target.value)}>{[.5,1,2,4,8].map(v=><option key={v} value={v}>{v}×</option>)}</select></label><button disabled={cursor===0} onClick={()=>{setPlaying(false);setReel(null);setCursor(c=>Math.max(0,Math.floor(c)-1));}}>Previous Possession</button><button disabled={finished} onClick={()=>{setPlaying(false);setReel(null);setCursor(c=>Math.min(total,Math.floor(c)+1));}}>Next Possession</button><button disabled={!nextHighlight} onClick={()=>nextHighlight&&jumpTo(nextHighlight)}>Next Highlight</button><button disabled={finished} onClick={()=>{setCursor(total);setPlaying(false);setReel(null);}}>Sim to End</button><button onClick={()=>{setReel(null);setCursor(0);setPlaying(true);}}>Restart Replay</button><button aria-pressed={sound} className={sound?'sound-on':''} onClick={()=>void toggleSound()}>{sound?'Sound: On':'Sound: Off'}</button><button onClick={onBoxScore}>{finished?'View Box Score':'Skip to Box Score'}</button></div>
    <div className="watch-scoreboard"><div><small>HOME</small><strong><TeamLink name={home.name} /></strong><b data-testid="watch-home-score">{score.home}</b></div><div className="watch-clock"><strong>{clockLabel}</strong><small>POSSESSION {Math.min(total,index+1)} / {total}</small></div><div><small>AWAY</small><strong><TeamLink name={away.name} /></strong><b data-testid="watch-away-score">{score.away}</b></div></div>
    </div>
    {soundNote&&!sound&&<p className="hint-text watch-sound-note">{soundNote}</p>}
    {halftimeOpen&&coaching&&<HalftimeSpeech teamName={coaching.teamName} roster={coaching.roster} starters={starters} margin={myMargin}
      onGive={(speech,boost)=>{setHalftimeOpen(false);const err=coaching.onCommand({kind:'speech',atPossession:halfAt,teamId:coaching.teamId,speech,boost,margin:myMargin});if(!err)setPlaying(true);}}
      onSkip={()=>{setHalftimeOpen(false);setPlaying(true);}}/>}
    <details className="watch-options"><summary>Camera & display</summary><div><label>Camera<select aria-label="Court camera" value={camera} onChange={e=>setCamera(e.target.value as CourtCamera)}><option value="follow">Close-up (follows the ball)</option><option value="broadcast">Broadcast (TV)</option><option value="full">Full court</option></select></label><label><input type="checkbox" checked={bigCam} onChange={e=>{setBigCam(e.target.checked);if(!e.target.checked)setBigmo(null);}}/> Big-moment replays</label><label><input type="checkbox" checked={shotChart} onChange={e=>setShotChart(e.target.checked)}/> Shot chart</label><label><input type="checkbox" checked={labels} onChange={e=>setLabels(e.target.checked)}/> Player names</label><label><input type="checkbox" checked={trail} onChange={e=>setTrail(e.target.checked)}/> Ball trail</label><button onClick={async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(screen.current?.requestFullscreen)await screen.current.requestFullscreen();else setScreenMessage('Fullscreen is unavailable in this browser.');}catch{setScreenMessage('Your browser could not enter fullscreen.');}}}>Toggle Fullscreen</button></div>{screenMessage&&<p role="status">{screenMessage}</p>}</details>
    {clip&&clipFrame&&<div ref={clipStage} className="clip-stage" aria-hidden="true" inert><WatchCourt frame={clipFrame} home={home} away={away} rosters={rosters} crowdFill={occasion?1:crowdFill} arena={court?.arena} building={court?.building} rivalry={!!court?.rivalryWeek} duos={court?.duos} coaches={court?.coaches} refs={crew.map(r=>r.number)} labels camera="full" bug={{homeScore:clipProgress>=.98?clip.h.homeScoreAfter:playbackScore(game,clip.h.index).home,awayScore:clipProgress>=.98?clip.h.awayScoreAfter:playbackScore(game,clip.h.index).away,clock:playbackClock(game,clip.h.index,clipProgress).replace(' · ',' ')}}/></div>}
    {clipOut&&<div className="share-modal" role="dialog" aria-label="Highlight clip" onClick={e=>{if(e.target===e.currentTarget)setClipOut(null);}}><div className="share-box">
      <img src={clipOut.url} alt={clipOut.text} width={640} height={416}/>
      <div className="contest-actions">{typeof navigator.share==='function'&&<button className="primary" onClick={()=>void saveClip('share')}>Share</button>}<button className={typeof navigator.share==='function'?'':'primary'} onClick={()=>void saveClip('download')}>Download GIF</button><button className="link-button" onClick={()=>setClipOut(null)}>Close</button></div>
      <p className="hint-text">{(clipOut.blob.size/1024/1024).toFixed(1)} MB GIF · plays on Discord, X and in messages.{clipStatus?` ${clipStatus}`:''}</p>
    </div></div>}
    <div ref={arena} className={`watch-stage ${bigmo?`bigmo-${bigmo.phase}`:''} ${frame?.callout?.text==='SLAM!'&&playing&&(frame.callout.t??1)<.45?'slam-shake':''}`}>
      {bigmo&&<div className={`bigmo-tag ${bigmo.phase}`} role="status">{bigmo.phase==='hit'?<b>{BIG_CALL[bigmo.h.kind]??HIGHLIGHT_LABEL[bigmo.h.kind].toUpperCase()}</b>:<><b>REPLAY</b><small>slow motion · {bigmo.h.playerId}</small></>}</div>}
      {reelNow&&<div className="watch-reel-banner" role="status"><b>HIGHLIGHT {reel!.pos+1}/{reel!.plays.length}</b><span>{HIGHLIGHT_LABEL[reelNow.kind]} · {reelNow.text}</span><button onClick={()=>{setReel(null);setPlaying(false);if(recording.current)void stopRecording();}}>{isRecording?'Stop recording':'Exit reel'}</button></div>}
      {frame?<WatchCourt frame={frame} home={home} away={away} rosters={rosters} crowdFill={occasion?1:crowdFill} arena={court?.arena} building={court?.building} rivalry={!!court?.rivalryWeek} duos={court?.duos} coaches={court?.coaches} refs={crew.map(r=>r.number)} crew={crew} hotId={hot?.playerId} labels={labels} trail={trail} camera={camera} ghosts={ghosts} shots={shots} bug={{homeScore:score.home,awayScore:score.away,clock:finished?'FINAL':clockLabel.replace(' · ',' '),shotClock}}/>:<p className="empty-state">This saved game has no possession log. Its final box score is still available.</p>}
    </div>
    <div className="watch-call" aria-live="polite" aria-atomic="true"><span className="pixel-eyebrow">COURTSIDE CALL</span><p><TeamText text={commentary ?? ''} /></p>{run&&<strong className="watch-run">{run.home?home.name:away.name} · {run.points}–0 RUN</strong>}{hot&&<strong className="hot-hand">ON FIRE · {hot.playerId} — {hot.threes} straight made threes</strong>}{finished&&!reel&&reelPlays.length>0&&<button className="primary watch-final-reel" onClick={startReel}><PixelIcon name="play" size={14}/> Watch the {reelPlays.length}-play highlight reel</button>}</div>

    {total>0&&<GameFlow log={game.possessionLog} completed={completed} total={total} homeName={home.name} awayName={away.name} onSeek={seek} markers={markers}/>}
    <label className="watch-seek">Replay timeline<input aria-label="Seek replay" type="range" min={0} max={Math.max(1,total)} step={.01} value={cursor} disabled={!total} onChange={e=>seek(+e.target.value)}/></label>
    {total>0&&<div className="watch-panels">
      <div className="watch-tabs" role="tablist" aria-label="Game panels">
        <button role="tab" aria-selected={tab==='box'} className={tab==='box'?'active':''} onClick={()=>setTab('box')}>Live Box Score</button>
        {coaching&&<button role="tab" aria-selected={tab==='coach'} className={tab==='coach'?'active':''} onClick={()=>{setTab('coach');setPlaying(false);}}>{coaching.openCoach||coaching.commands.length?'Coach':'Take over (Coach)'}</button>}
        <button role="tab" aria-selected={tab==='highlights'} className={tab==='highlights'?'active':''} onClick={()=>setTab('highlights')}>Highlights{markers.length?` (${markers.length})`:''}</button>
      </div>
      <div role="tabpanel" className="watch-tabpanel">
        {tab==='box'&&<LiveBoxPanel home={live.home} away={live.away} homeName={home.name} awayName={away.name}/>}
        {tab==='coach'&&coaching&&myTeam&&<CoachPanel key={lastShotNow||crunchNow?`ls${coachAt}`:'coach'} coaching={coaching} team={myTeam} opponent={theirTeam??undefined} run={coachRun} lastShotNow={lastShotNow} crunchNow={crunchNow} callPlays={callPlays} onCallPlays={setCallPlays} crunchAt={!finished&&crunchAt>coachAt?crunchAt:undefined} onSkipToCrunch={()=>{prompted.current=-1;seek(crunchAt);}} onResume={()=>setPlaying(true)} atPossession={coachAt} finished={finished} clockLabel={clockLabel} onDecision={()=>{setPlaying(false);setReel(null);}}/>}
        {tab==='highlights'&&<HighlightsPanel highlights={highlights} completed={completed} finished={finished} regulationPeriods={regulation} onJump={jumpTo} onReel={startReel} reelCount={reelPlays.length} onShare={()=>void share()} shareStatus={shareStatus} onVideo={canRecordReel()?()=>void recordVideo():undefined} videoStatus={videoStatus} onClip={h=>void makeClip(h)} onTikTok={h=>void makeClip(h,true)} clipStatus={clip?clipStatus:clipOut?null:clipStatus}/>}
      </div>
    </div>}
    <p className="hint-text">Results come from the recorded game; movement and ball physics reconstruct the action. Older saves reconstruct free-throw order from recorded totals. Space pauses; arrow keys step possessions when this viewer is focused. Sim to End counts no extra games.</p>
    <details className="watch-recent"><summary>Recent possessions</summary><ol>{game.possessionLog.slice(Math.max(0,completed-6),completed).reverse().map((p,i)=><li key={completed-i}><strong>{playbackClock(game,completed-i-1,1)}</strong> {p.events.join(' · ')} <span>{p.homeScoreAfter}–{p.awayScoreAfter}</span></li>)}</ol></details>
  </section>;
}
