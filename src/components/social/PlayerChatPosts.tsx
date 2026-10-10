import { useMemo } from 'react';
import type { League } from '../../simulation/league';
import { courtChatFeed } from '../../social/courtChat';
import { ChatPostView } from './ChatPostView';
import './courtChat.css';

/** A player's latest CourtChat posts (and posts about him), on his profile. */
export function PlayerChatPosts({ league, playerId, controlledTeamId }: { league: League; playerId: string; controlledTeamId: string | null }) {
  const posts = useMemo(() => courtChatFeed(league, { games: 80, controlledTeamId }).filter(p => p.author.playerId === playerId || p.targetId === playerId || p.replies.some(r => r.author.playerId === playerId)).slice(0, 4), [league, playerId, controlledTeamId]);
  if (!posts.length) return null;
  const teamName = (id: string | null) => league.teams.find(t => t.teamId === id)?.name ?? 'Free agent';
  return <section className="cc-player-posts">
    <h4>On CourtChat</h4>
    <div className="cc-feed">{posts.map(p => <ChatPostView key={p.id} p={p} compact teamName={teamName} controlledTeamId={controlledTeamId} />)}</div>
  </section>;
}
