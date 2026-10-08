import { useMemo, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { cardPool, seasonLabel, type HuntCard } from '../../hunt/cards';
import { categoryById, TIER_LABEL } from '../../perfect/categories';
import { boardOf, battlePick, battleRating, playBattleGame, sideCards, onClock, seriesScore, battleWinner, RIVALS, BATTLE_PICKS, type Battle, type BattleRival } from '../../perfect/battle';
import { PlayerAvatar } from '../PlayerAvatar';
import { PixelIcon } from '../PixelIcon';
import { ShareCardButton } from '../ShareCardButton';

const POS_COLOR: Record<string, string> = { PG: '#4da3ff', SG: '#55c878', SF: '#ffd166', PF: '#f47b20', C: '#e85d5d', G: '#4da3ff', F: '#ffd166' };
const PAGE = 24;
const lastName = (n: string) => n.split(' ').slice(-1)[0];

/** The start screen: pick a rival (three AI GMs or a friend on this device). */
export function BattleSetup({ onStart, onCancel }: { onStart: (rival: BattleRival, names: [string, string]) => void; onCancel: () => void }) {
  const [p1, setP1] = useState('Player 1'), [p2, setP2] = useState('Player 2');
  const [friend, setFriend] = useState(false);
  return <section className="p820-battle-setup">
    <span className="pixel-eyebrow">DRAFT BATTLE</span>
    <h2>One category. Two GMs. A snake draft.</h2>
    <p className="hint-text">The game rolls a category and you take turns picking from it (1-2-2-1…), {BATTLE_PICKS} players each. Then your two teams play a best-of-seven. No ratings while you draft.</p>
    <div className="p820-modes">
      {(['rookie', 'pro', 'legend'] as BattleRival[]).map(r => <button key={r} className="p820-mode" onClick={() => onStart(r, ['You', RIVALS[r].gm])}>
        <span className="hunt-mode-icon"><PixelIcon name={r === 'legend' ? 'crown' : r === 'pro' ? 'star' : 'team'} size={24} /></span><b>vs {RIVALS[r].gm}</b><small>{RIVALS[r].name}: {RIVALS[r].blurb}</small><em>Start</em></button>)}
      <button className={`p820-mode ${friend ? 'on' : ''}`} onClick={() => setFriend(true)}>
        <span className="hunt-mode-icon"><PixelIcon name="phone" size={24} /></span><b>vs a friend</b><small>Pass the device: you pick in turns, then watch the series together.</small><em>Set up</em></button>
    </div>
    {friend && <div className="p820-battle-names">
      <label>Player 1 <input value={p1} maxLength={16} onChange={e => setP1(e.target.value)} /></label>
      <label>Player 2 <input value={p2} maxLength={16} onChange={e => setP2(e.target.value)} /></label>
      <button className="primary" onClick={() => onStart('friend', [p1.trim() || 'Player 1', p2.trim() || 'Player 2'])}><PixelIcon name="play" size={14} /> Start the draft</button>
    </div>}
    <button className="link-button" onClick={onCancel}>Back to the 82-0 hub</button>
  </section>;
}

function Bare({ c, onPick }: { c: HuntCard; onPick?: () => void }) {
  const inner = <><PlayerAvatar playerId={c.name} primaryColor={POS_COLOR[c.pos] ?? '#f47b20'} secondaryColor="#f4f0e6" size={40} mode="portrait" />
    <span className="p820-card-text"><b>{c.name}</b><small>{c.pos}</small></span></>;
  return onPick ? <button className="p820-card p820-card-bare" onClick={onPick}>{inner}</button> : <div className="p820-card p820-card-bare">{inner}</div>;
}

/** The draft, the series and the result. */
export function DraftBattle({ h, battle, setBattle, onDone }: { h: NbaHistory; battle: Battle; setBattle: (b: Battle | null) => void; onDone: () => void }) {
  const cat = categoryById(h, battle.cat);
  const pool = cardPool(h);
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);
  const board = useMemo(() => [...boardOf(h, battle)].sort((a, b) => lastName(a.name).localeCompare(lastName(b.name)) || a.name.localeCompare(b.name)), [h, battle]);
  const needle = q.trim().toLowerCase();
  const list = needle ? board.filter(c => c.name.toLowerCase().includes(needle)) : board;
  const clock = onClock(battle);
  const done = battle.stage === 'done';
  const score = seriesScore(battle);
  const winner = battleWinner(battle);
  const side = (s: 0 | 1) => {
    const cards = sideCards(battle, s).map(id => pool.byId.get(id)!);
    return <div className={`p820-battle-side ${clock === s ? 'on-clock' : ''} ${winner === s ? 'winner' : ''}`}>
      <div className="p820-battle-name"><b>{battle.names[s]}</b>{battle.stage !== 'draft' && <span>Team rating {battleRating(h, battle, s)}</span>}{clock === s && <em>ON THE CLOCK</em>}</div>
      <ol>{Array.from({ length: BATTLE_PICKS }, (_, i) => <li key={i}>{cards[i] ? <><span className="p820-slot">{i < 5 ? 'START' : 'BENCH'}</span><b>{cards[i].name}</b><small>{cards[i].pos}{battle.stage !== 'draft' ? ` · ${seasonLabel(cards[i].end)} · ${cards[i].ovr}` : ''}</small></> : <span className="p820-slot">{i < 5 ? 'START' : 'BENCH'} —</span>}</li>)}</ol>
    </div>;
  };
  return <section className="p820-battle">
    <div className={`p820-catroll revealed tier-${(cat?.tier ?? 'b').toLowerCase()}`}>
      <span className="p820-cat-group">{cat?.group.toUpperCase()}</span>
      <span className="p820-cat-name">{cat?.name}</span>
      <span className="p820-cat-blurb">{cat?.blurb} · {cat?.size} players · tier {cat?.tier} ({cat ? TIER_LABEL[cat.tier] : ''})</span>
    </div>
    <div className="p820-battle-teams">{side(0)}<div className="p820-battle-vs">{battle.stage === 'draft' ? `PICK ${battle.picks.length + 1} OF ${BATTLE_PICKS * 2}` : `${score.a} - ${score.b}`}</div>{side(1)}</div>
    {battle.stage === 'draft' && <>
      <p className="hint-text">{battle.rival === 'friend' ? <><b>{battle.names[clock!]}</b>, your pick. {clock === 0 ? 'Then pass it over.' : ''}</> : clock === 0 ? 'Your pick. The rival answers right away.' : ''} Ratings stay hidden until the series.</p>
      <input className="year-input p820-search" placeholder={`Search ${board.length} players`} value={q} onChange={e => { setQ(e.target.value); setShown(PAGE); }} aria-label="Search the board" />
      <div className="p820-pool">{list.slice(0, shown).map(c => <Bare key={c.id} c={c} onPick={() => { setQ(''); setBattle(battlePick(h, battle, c.id)); }} />)}</div>
      {list.length > shown && <button onClick={() => setShown(n => n + PAGE)}>Show more ({list.length - shown})</button>}
    </>}
    {battle.stage !== 'draft' && <div className="p820-battle-series">
      <ol className="p820-battle-games">{battle.games.map((g, i) => <li key={i} className={g.a > g.b ? 'a' : 'b'}><span>Game {i + 1}</span><b>{g.a}-{g.b}</b><small>{g.top}</small></li>)}</ol>
      {battle.stage === 'series' && <div className="contest-actions">
        <button className="primary" onClick={() => setBattle(playBattleGame(h, battle))}><PixelIcon name="play" size={14} /> Play game {battle.games.length + 1}</button>
        <button onClick={() => { let b = battle; while (b.stage === 'series') b = playBattleGame(h, b); setBattle(b); }}>Sim the series</button>
      </div>}
      {done && <div className={`p820-final ${winner === 0 ? 'champ' : ''}`}>
        <span className="pixel-eyebrow">{winner === 0 && battle.rival !== 'friend' ? 'YOU WIN THE BATTLE' : `${battle.names[winner!].toUpperCase()} WINS`}</span>
        <div className="p820-final-record">{Math.max(score.a, score.b)}-{Math.min(score.a, score.b)}</div>
        <p>{score.a + score.b === 7 ? 'All the way to Game 7.' : Math.min(score.a, score.b) === 0 ? 'A sweep.' : 'Series over.'} Everyone's ratings are shown above.</p>
        <div className="contest-actions"><button className="primary" onClick={() => { setBattle(null); onDone(); }}><PixelIcon name="play" size={14} /> New battle</button>
          <ShareCardButton tall fileName="draft-battle.png" label="Share card" text={`Draft Battle on ${cat?.name ?? 'one category'}: ${battle.names[0]} ${score.a}-${score.b} ${battle.names[1]}. Draft your own on Court Vision.`} spec={{
            kicker: `Draft Battle · ${cat?.name ?? ''}`,
            title: `${score.a}-${score.b}`,
            subtitle: `${battle.names[0]} vs ${battle.names[1]} · ${winner === 0 ? `${battle.names[0]} wins` : `${battle.names[1]} wins`}`,
            badge: score.a + score.b === 7 ? 'WENT THE DISTANCE · GAME 7' : Math.min(score.a, score.b) === 0 ? 'SWEEP' : undefined,
            stats: [{ label: battle.names[0], value: String(battleRating(h, battle, 0)) }, { label: battle.names[1], value: String(battleRating(h, battle, 1)) }, { label: 'Series', value: `${score.a}-${score.b}` }, { label: 'Tier', value: cat?.tier ?? '-' }],
            lines: sideCards(battle, 0).slice(0, 5).map(id => { const c = pool.byId.get(id)!; return `${c.name} ${seasonLabel(c.end)} · ${c.ovr}`; }),
            results: battle.games.map(g => ({ won: g.a > g.b })),
            avatar: (() => { const top = sideCards(battle, 0).map(id => pool.byId.get(id)!).sort((a, b) => b.ovr - a.ovr)[0]; return top ? { playerId: top.name, primary: POS_COLOR[top.pos] } : undefined; })(),
            accent: winner === 0 ? 'green' : 'red',
          }} /></div>
      </div>}
    </div>}
    {!done && <button className="link-button" onClick={() => { if (window.confirm('Leave this battle? It will not count.')) setBattle(null); }}>Leave the battle</button>}
  </section>;
}
