import { useState } from 'react';
import type { ChatPost } from '../../social/courtChat';
import { PlayerAvatar } from '../PlayerAvatar';
import { PixelIcon } from '../PixelIcon';

const TYPE_TAG: Record<string, string> = { Leader: 'LEADER', Hothead: 'HOTHEAD', 'Star Ego': 'STAR EGO', Mercenary: 'MERCENARY', Competitor: 'COMPETITOR', Loyal: 'LOYAL', Professional: 'PRO' };
const ROLE_ICON = { fan: 'heart', insider: 'search', gm: 'crown', player: 'jersey' } as const;
const shortCount = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

export interface PostActions {
  liked?: Set<string>; onLike?: (id: string) => void;
  follows?: string[]; onFollow?: (playerId: string) => void; onMute?: (playerId: string) => void;
  onSelectPlayer?: (id: string) => void; onTag?: (tag: string) => void;
}

/** One CourtChat post (and its replies). */
export function ChatPostView({ p, reply = false, teamName, controlledTeamId, highlight = false, compact = false, ...act }: PostActions & { p: ChatPost; reply?: boolean; teamName: (id: string | null) => string; controlledTeamId: string | null; highlight?: boolean; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const on = !!act.liked?.has(p.id);
  const a = p.author, isPlayer = a.role === 'player';
  const following = isPlayer && !!act.follows?.includes(a.playerId);
  const copy = () => { navigator.clipboard?.writeText(`${a.name} (${a.handle}) on CourtChat: ${p.text}`).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }, () => {}); };
  const open = () => { if (isPlayer) act.onSelectPlayer?.(a.playerId); };
  return <article className={`cc-post ${reply ? 'reply' : ''} ${p.roast ? 'roast' : ''} cc-${p.kind} cc-role-${a.role} ${highlight ? 'cc-highlight' : ''}`}>
    {isPlayer
      ? <button className="cc-avatar" onClick={open} aria-label={`Open ${a.name}`}><PlayerAvatar playerId={a.playerId} teamId={a.teamId ?? undefined} jerseyNumber={a.jersey} mode="portrait" size={reply || compact ? 34 : 44} /></button>
      : <span className={`cc-avatar cc-avatar-icon cc-avatar-${a.role}`} aria-hidden="true"><PixelIcon name={ROLE_ICON[a.role]} size={reply || compact ? 16 : 20} /></span>}
    <div className="cc-body">
      <header>
        {isPlayer ? <button className="link-button cc-name" onClick={open}>{a.name}</button> : <b className="cc-name">{a.name}</b>}
        {a.verified && <span className="cc-verified" title={a.role === 'player' ? 'Verified: one of the league\'s best' : 'Verified'} aria-label="Verified"><PixelIcon name="check" size={10} /></span>}
        <span className="cc-handle">{a.handle}</span>
        {isPlayer && <span className={`cc-type cc-type-${a.type.replace(/\s/g, '').toLowerCase()}`} title={`${a.type} personality`}>{TYPE_TAG[a.type]}</span>}
        {a.role === 'gm' && <span className="cc-type cc-type-gm">GM</span>}
        {a.role === 'insider' && <span className="cc-type cc-type-insider">INSIDER</span>}
        {a.role === 'fan' && <span className="cc-type">FAN</span>}
        {controlledTeamId && a.teamId === controlledTeamId && a.role === 'player' && <span className="cc-yours">YOUR TEAM</span>}
        {isPlayer && act.onFollow && !reply && <button className={`cc-follow ${following ? 'on' : ''}`} onClick={() => act.onFollow!(a.playerId)} aria-pressed={following}>{following ? 'Following' : 'Follow'}</button>}
      </header>
      {!reply && p.context && <small className="cc-context">{p.roast ? <><PixelIcon name="flame" size={11} /> {a.role === 'gm' ? 'Spicy' : 'Roast'} · </> : null}{a.role !== 'insider' ? `${teamName(a.teamId)} · ` : ''}{p.context}</small>}
      <p className="cc-text">{p.text}</p>
      {!reply && !compact && p.tags.length > 0 && <div className="cc-tags">{p.tags.map(t => act.onTag ? <button key={t} className="link-button cc-tag" onClick={() => act.onTag!(t)}>{t}</button> : <span key={t} className="cc-tag">{t}</span>)}</div>}
      <footer>
        {act.onLike ? <button className={`cc-like ${on ? 'on' : ''}`} onClick={() => act.onLike!(p.id)} aria-pressed={on} aria-label={on ? 'Unlike' : 'Like'}><PixelIcon name="heart" size={12} /> {shortCount(p.likes + (on ? 1 : 0))}</button>
          : <span className="cc-like"><PixelIcon name="heart" size={12} /> {shortCount(p.likes)}</span>}
        <span className="cc-repost"><PixelIcon name="shuffle" size={12} /> {shortCount(p.reposts)}</span>
        {p.replies.length > 0 && <span className="cc-reply-count"><PixelIcon name="list" size={12} /> {p.replies.length}</span>}
        {!compact && <button className="cc-action" onClick={copy} aria-label="Copy post">{copied ? 'Copied' : 'Copy'}</button>}
        {!compact && isPlayer && act.onMute && !reply && <button className="cc-action" onClick={() => act.onMute!(a.playerId)} aria-label={`Mute ${a.name}`}>Mute</button>}
      </footer>
      {p.replies.length > 0 && !compact && <div className="cc-replies">{p.replies.map(r => <ChatPostView key={r.id} p={r} reply teamName={teamName} controlledTeamId={controlledTeamId} {...act} />)}</div>}
    </div>
  </article>;
}
