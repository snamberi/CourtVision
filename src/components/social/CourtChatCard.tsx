import { useMemo } from 'react';
import type { League } from '../../simulation/league';
import { courtChatFeed } from '../../social/courtChat';
import { fanApproval } from '../../social/gmPosts';
import { ChatPostView } from './ChatPostView';
import { PixelIcon } from '../PixelIcon';
import './courtChat.css';

/** The dashboard's CourtChat card: the latest posts about your team, and your fans' mood. */
export function CourtChatCard({ league, teamId, onOpen, onSelectPlayer }: { league: League; teamId: string; onOpen: () => void; onSelectPlayer: (id: string) => void }) {
  const posts = useMemo(() => courtChatFeed(league, { games: 30, teamId, controlledTeamId: teamId }).slice(0, 3), [league, teamId]);
  const approval = fanApproval(league, teamId);
  const teamName = (id: string | null) => league.teams.find(t => t.teamId === id)?.name ?? 'Free agent';
  return <section className="dashboard-panel cc-card" aria-label="CourtChat">
    <div className="cc-card-head"><h5><PixelIcon name="phone" size={14} /> CourtChat</h5><small>Fans: {approval.score} · {approval.label}</small></div>
    {posts.length ? <div className="cc-feed">{posts.map(p => <ChatPostView key={p.id} p={p} compact teamName={teamName} controlledTeamId={teamId} onSelectPlayer={onSelectPlayer} />)}</div>
      : <p className="hint-text">Nothing about your team yet. Play a few games.</p>}
    <div className="cc-card-actions"><button className="primary" onClick={onOpen}>Open CourtChat</button><button onClick={onOpen}>Post as GM</button></div>
  </section>;
}
