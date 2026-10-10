import { useMemo, useState } from 'react';
import type { League } from '../../simulation/league';
import type { GMLeagueExtras } from '../../simulation/gm';
import { courtChatFeed, trending, postOfTheWeek, type ChatPost } from '../../social/courtChat';
import { variantCount } from '../../social/chatTemplates';
import { postAsGm, postsLeftToday, fanApproval, draftText, MAX_POST_LENGTH, type GmPostKind } from '../../social/gmPosts';
import { readFollows, readMutes, toggleIn, clearMutes, FOLLOW_KEY, MUTE_KEY } from '../../social/prefs';
import { ChatPostView } from './ChatPostView';
import { PixelIcon } from '../PixelIcon';
import './courtChat.css';

interface Props { league: League; extras?: GMLeagueExtras; controlledTeamId: string | null; onSelectPlayer: (id: string) => void; onChange?: (league: League) => void }
type Filter = 'all' | 'mine' | 'following' | 'roasts' | 'big' | 'gm';
const PAGE = 30;
const KINDS: { id: GmPostKind; label: string; hint: string }[] = [
  { id: 'hype', label: 'Hype the team', hint: 'Fans and players answer. Lands best when you are winning.' },
  { id: 'praise', label: 'Praise a player', hint: 'He answers. Most players like it (star egos love it): a morale boost for 15 games.' },
  { id: 'callout', label: 'Call out a player', hint: 'Hotheads and star egos take it badly; competitors take it as fuel. Lasts 15 games.' },
  { id: 'rival', label: 'Trash-talk a team', hint: 'Their loudest player answers, and fans love it.' },
  { id: 'free', label: 'Write your own', hint: 'Anything (keep it friendly).' },
];

/** CourtChat: what the league's players (and fans, and the insider, and you) are posting. */
export function CourtChatPage({ league, extras, controlledTeamId, onSelectPlayer, onChange }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [follows, setFollows] = useState<string[]>(readFollows);
  const [mutes, setMutes] = useState<string[]>(readMutes);
  const feedOpts = { games: 60, controlledTeamId, tradeBlock: extras?.tradeBlock };
  const all = useMemo(() => courtChatFeed(league, feedOpts), [league, controlledTeamId, extras?.tradeBlock]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = useMemo(() => (controlledTeamId ? courtChatFeed(league, { ...feedOpts, teamId: controlledTeamId }) : []), [league, controlledTeamId, extras?.tradeBlock]); // eslint-disable-line react-hooks/exhaustive-deps
  const trends = useMemo(() => trending(all), [all]);
  const potw = useMemo(() => postOfTheWeek(all, league), [all, league]);
  const teamName = (id: string | null) => league.teams.find(t => t.teamId === id)?.name ?? 'Free agent';
  const q = query.trim().toLowerCase();
  const visible = (p: ChatPost) => !mutes.includes(p.author.playerId);
  let list = filter === 'mine' ? mine : all;
  if (filter === 'following') list = all.filter(p => follows.includes(p.author.playerId) || p.replies.some(r => follows.includes(r.author.playerId)));
  if (filter === 'roasts') list = all.filter(p => p.roast || p.replies.some(r => r.kind === 'clapback'));
  if (filter === 'big') list = all.filter(p => ['bigNight', 'milestone', 'winStreak', 'champion', 'award', 'seriesWin'].includes(p.kind));
  if (filter === 'gm') list = all.filter(p => p.author.role === 'gm');
  if (tag) list = list.filter(p => p.tags.includes(tag));
  if (q) list = list.filter(p => [p.text, p.author.name, p.author.handle, ...p.replies.map(r => r.text)].some(s => s.toLowerCase().includes(q)));
  list = list.filter(visible);

  const actions = {
    liked, onLike: (id: string) => setLiked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
    follows, onFollow: (id: string) => setFollows(toggleIn(FOLLOW_KEY, id)), onMute: (id: string) => setMutes(toggleIn(MUTE_KEY, id)),
    onSelectPlayer, onTag: (t: string) => { setTag(t); setShown(PAGE); },
  };
  const approval = controlledTeamId ? fanApproval(league, controlledTeamId) : null;

  return <div className="courtchat-page">
    <header className="cc-head">
      <span className="pixel-eyebrow">THE LEAGUE'S GROUP CHAT</span><h2>CourtChat</h2>
      <p className="hint-text">Players post after games in their own voice: leaders lift the team, hotheads roast, star egos brag, mercenaries talk money. Fans and the Court Insider chime in. {variantCount().toLocaleString()} different posts.</p>
    </header>
    <div className="cc-layout">
      <div className="cc-main">
        {controlledTeamId && onChange && <Composer league={league} teamId={controlledTeamId} onPost={onChange} />}
        <div className="cc-controls">
          <div className="stats-view-toggle" role="tablist" aria-label="CourtChat filters">
            {([['all', `All (${all.length})`], ...(controlledTeamId ? [['mine', `Your team (${mine.length})`]] : []), ['following', `Following (${follows.length})`], ['roasts', 'Roasts'], ['big', 'Big moments'], ['gm', 'GM posts']] as [Filter, string][])
              .map(([k, label]) => <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'active' : ''} onClick={() => { setFilter(k); setShown(PAGE); }}>{label}</button>)}
          </div>
          <input className="year-input cc-search" type="search" value={query} onChange={e => { setQuery(e.target.value); setShown(PAGE); }} placeholder="Search posts, players, @handles" aria-label="Search CourtChat" />
        </div>
        {(tag || mutes.length > 0) && <p className="cc-chips">
          {tag && <button className="cc-chip" onClick={() => setTag(null)}>{tag} ✕</button>}
          {mutes.length > 0 && <button className="link-button" onClick={() => { clearMutes(); setMutes([]); }}>{mutes.length} muted · unmute all</button>}
        </p>}
        {list.length === 0 ? <p className="empty-state">{all.length ? (filter === 'following' && !follows.length ? 'Follow players (the Follow button on their posts) to see them here.' : 'Nothing matches.') : 'The timeline is quiet. Play a few games and the players will start posting.'}</p>
          : <div className="cc-feed">{list.slice(0, shown).map(p => <ChatPostView key={p.id} p={p} teamName={teamName} controlledTeamId={controlledTeamId} {...actions} />)}</div>}
        {list.length > shown && <button className="cc-more" onClick={() => setShown(n => n + PAGE)}>Show more ({list.length - shown})</button>}
      </div>
      <aside className="cc-side">
        {approval && <section className="cc-panel">
          <h3>Fan approval</h3>
          <div className="cc-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={approval.score} aria-label="Fan approval"><i style={{ width: `${approval.score}%` }} className={approval.score >= 60 ? 'good' : approval.score >= 40 ? 'mid' : 'bad'} /></div>
          <p><b>{approval.score}</b> · {approval.label}</p>
          <small className="hint-text">Winning moves it most; how your posts land moves it too.</small>
        </section>}
        {trends.length > 0 && <section className="cc-panel">
          <h3>Trending</h3>
          <ol className="cc-trends">{trends.map(t => <li key={t.tag}><button className="link-button" onClick={() => { setTag(t.tag); setShown(PAGE); }}>{t.tag}</button><small>{t.count} posts</small></li>)}</ol>
        </section>}
        {potw && <section className="cc-panel">
          <h3>Post of the Week</h3>
          <ChatPostView p={{ ...potw, replies: [] }} teamName={teamName} controlledTeamId={controlledTeamId} compact onSelectPlayer={onSelectPlayer} />
        </section>}
      </aside>
    </div>
  </div>;
}

function Composer({ league, teamId, onPost }: { league: League; teamId: string; onPost: (l: League) => void }) {
  const team = league.teams.find(t => t.teamId === teamId)!;
  const roster = [...team.seasons].sort((a, b) => a.playerId.localeCompare(b.playerId));
  const others = league.teams.filter(t => t.teamId !== teamId).sort((a, b) => a.name.localeCompare(b.name));
  const [kind, setKind] = useState<GmPostKind>('hype');
  const [player, setPlayer] = useState(roster[0]?.playerId ?? '');
  const [rival, setRival] = useState(others[0]?.teamId ?? '');
  const short = (n: string) => n.split(' ').at(-1) ?? n;
  const [text, setText] = useState(() => draftText('hype', { team: short(team.name) }));
  const [msg, setMsg] = useState<string | null>(null);
  const left = postsLeftToday(league, teamId);
  const reset = (k: GmPostKind, p = player, r = rival) => setText(draftText(k, { team: short(team.name), player: p, rival: short(league.teams.find(t => t.teamId === r)?.name ?? '') }));
  const submit = () => {
    const out = postAsGm(league, teamId, { kind, text, playerId: player, rivalTeamId: rival });
    if ('error' in out) { setMsg(out.error); return; }
    setMsg('Posted. Scroll down to see who answered.');
    onPost(out.league);
    if (kind === 'free') setText('');
  };
  const info = KINDS.find(k => k.id === kind)!;
  return <section className="cc-compose" aria-label="Post as the GM">
    <div className="cc-compose-head"><PixelIcon name="crown" size={16} /><b>Post as the {short(team.name)} GM</b><small>{left} post{left === 1 ? '' : 's'} left before the next game</small></div>
    <div className="cc-kinds" role="radiogroup" aria-label="What to post">{KINDS.map(k => <button key={k.id} role="radio" aria-checked={kind === k.id} className={kind === k.id ? 'on' : ''} onClick={() => { setKind(k.id); reset(k.id); setMsg(null); }}>{k.label}</button>)}</div>
    {(kind === 'praise' || kind === 'callout') && <label className="cc-pick">Player <select value={player} onChange={e => { setPlayer(e.target.value); reset(kind, e.target.value); }}>{roster.map(p => <option key={p.playerId} value={p.playerId}>{p.playerId}</option>)}</select></label>}
    {kind === 'rival' && <label className="cc-pick">Team <select value={rival} onChange={e => { setRival(e.target.value); reset(kind, player, e.target.value); }}>{others.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}</select></label>}
    <textarea className="cc-textarea" value={text} maxLength={MAX_POST_LENGTH} onChange={e => { setText(e.target.value); setMsg(null); }} rows={3} placeholder="What's on your mind, GM?" aria-label="Your post" />
    <div className="cc-compose-foot">
      <small className="hint-text">{info.hint}</small>
      <span>{text.length}/{MAX_POST_LENGTH}</span>
      <button className="primary" onClick={submit} disabled={!left || !text.trim()}>Post</button>
    </div>
    {msg && <p className="cc-msg" role="status">{msg}</p>}
  </section>;
}
