import { useMemo, useState } from 'react';
import type { League } from '../../simulation/league';
import { courtChatFeed, type ChatPost } from '../../social/courtChat';
import { variantCount } from '../../social/chatTemplates';
import { PlayerAvatar } from '../PlayerAvatar';
import { PixelIcon } from '../PixelIcon';
import './courtChat.css';

interface Props { league: League; controlledTeamId: string | null; onSelectPlayer: (id: string) => void }
type Filter = 'all' | 'mine' | 'roasts' | 'big';
const PAGE = 30;
const TYPE_TAG: Record<string, string> = { Leader: 'LEADER', Hothead: 'HOTHEAD', 'Star Ego': 'STAR EGO', Mercenary: 'MERCENARY', Competitor: 'COMPETITOR', Loyal: 'LOYAL', Professional: 'PRO' };
const short = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

/** CourtChat: what the league's players are posting, in their own voice. */
export function CourtChatPage({ league, controlledTeamId, onSelectPlayer }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE);
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const all = useMemo(() => courtChatFeed(league, { games: 60 }), [league]);
  const mine = useMemo(() => (controlledTeamId ? courtChatFeed(league, { games: 60, teamId: controlledTeamId }) : []), [league, controlledTeamId]);
  const list = filter === 'mine' ? mine : filter === 'roasts' ? all.filter(p => p.roast || p.replies.some(r => r.kind === 'clapback')) : filter === 'big' ? all.filter(p => p.kind === 'bigNight' || p.kind === 'winStreak') : all;
  const toggle = (id: string) => setLiked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const teamName = (id: string | null) => league.teams.find(t => t.teamId === id)?.name ?? 'Free agent';

  const Post = ({ p, reply = false }: { p: ChatPost; reply?: boolean }) => {
    const on = liked.has(p.id);
    return <article className={`cc-post ${reply ? 'reply' : ''} ${p.roast ? 'roast' : ''} cc-${p.kind}`}>
      <button className="cc-avatar" onClick={() => onSelectPlayer(p.author.playerId)} aria-label={`Open ${p.author.name}`}>
        <PlayerAvatar playerId={p.author.playerId} teamId={p.author.teamId ?? undefined} jerseyNumber={p.author.jersey} mode="portrait" size={reply ? 34 : 44} />
      </button>
      <div className="cc-body">
        <header>
          <button className="link-button cc-name" onClick={() => onSelectPlayer(p.author.playerId)}>{p.author.name}</button>
          <span className="cc-handle">{p.author.handle}</span>
          <span className={`cc-type cc-type-${p.author.type.replace(/\s/g, '').toLowerCase()}`} title={`${p.author.type} personality`}>{TYPE_TAG[p.author.type]}</span>
          {p.author.teamId === controlledTeamId && controlledTeamId && <span className="cc-yours">YOUR TEAM</span>}
        </header>
        {!reply && <small className="cc-context">{p.roast ? <><PixelIcon name="flame" size={11} /> Roast · </> : null}{teamName(p.author.teamId)} · {p.context}</small>}
        <p className="cc-text">{p.text}</p>
        <footer>
          <button className={`cc-like ${on ? 'on' : ''}`} onClick={() => toggle(p.id)} aria-pressed={on} aria-label={on ? 'Unlike' : 'Like'}><PixelIcon name="heart" size={12} /> {short(p.likes + (on ? 1 : 0))}</button>
          <span className="cc-repost"><PixelIcon name="shuffle" size={12} /> {short(p.reposts)}</span>
          {p.replies.length > 0 && <span className="cc-reply-count"><PixelIcon name="list" size={12} /> {p.replies.length}</span>}
        </footer>
        {p.replies.length > 0 && <div className="cc-replies">{p.replies.map(r => <Post key={r.id} p={r} reply />)}</div>}
      </div>
    </article>;
  };

  return <div className="courtchat-page">
    <header className="cc-head">
      <div><span className="pixel-eyebrow">THE LEAGUE'S GROUP CHAT</span><h2>CourtChat</h2>
        <p className="hint-text">Players post after games in their own voice: leaders lift the team, hotheads roast, star egos brag, mercenaries talk money. {variantCount().toLocaleString()} different posts and counting.</p></div>
    </header>
    <div className="stats-view-toggle" role="tablist" aria-label="CourtChat filters">
      {([['all', `All (${all.length})`], ...(controlledTeamId ? [['mine', `Your team (${mine.length})`]] : []), ['roasts', 'Roasts'], ['big', 'Big nights']] as [Filter, string][])
        .map(([k, label]) => <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'active' : ''} onClick={() => { setFilter(k); setShown(PAGE); }}>{label}</button>)}
    </div>
    {list.length === 0 ? <p className="empty-state">{all.length ? 'Nothing here yet.' : 'The timeline is quiet. Play a few games and the players will start posting.'}</p>
      : <div className="cc-feed">{list.slice(0, shown).map(p => <Post key={p.id} p={p} />)}</div>}
    {list.length > shown && <button className="cc-more" onClick={() => setShown(n => n + PAGE)}>Show more ({list.length - shown})</button>}
  </div>;
}
