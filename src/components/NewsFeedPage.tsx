import { formatSeasonYear } from '../simulation/calendar';
import { TeamLink, TeamText } from './TeamLink';
import { TeamLogo } from './TeamLogo';
import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { generateNewsFeed, type NewsCategory } from '../simulation/news';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  onSelectPlayer?: (id: string) => void; onGame?: (id: string) => void; onPlayoffs?: () => void;
  onWatchHighlight?: (gameId: string, possession: number) => void;
}

const ALL_CATEGORIES: NewsCategory[] = ['Highlights', 'Awards', 'Draft', 'League', 'Injuries', 'Player Feats', 'Playoffs', 'Transactions', 'Teams', 'Rivalries', 'Records'];

export function NewsFeedPage({ league, extras, onSelectPlayer, onGame, onPlayoffs, onWatchHighlight }: Props) {
  const [teamFilter, setTeamFilter] = useState('all');
  const [seasonFilter, setSeasonFilter] = useState('all');
  const [active, setActive] = useState<Set<NewsCategory>>(new Set(ALL_CATEGORIES));
  const items = useMemo(() => generateNewsFeed(league, extras), [league, extras]);
  const filtered = items.filter((i) => active.has(i.category) && (teamFilter === 'all' || i.teamId === teamFilter) && (seasonFilter === 'all' || i.season === seasonFilter));

  const toggle = (cat: NewsCategory) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  return (
    <div className="news-feed-page">
      <span className="pixel-eyebrow">THE LEAGUE WIRE</span><h4>News Feed</h4>
      <p className="hint-text">Game nights, emerging stars, familiar faces. Every headline comes from your league’s results and history.</p>
      <div className="news-selectors"><label>Team<select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}><option value="all">All teams</option>{league.teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}</select></label>
      <label>Season<select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)}><option value="all">All seasons</option>{[...new Set(items.map(i => i.season).filter(Boolean))].map(s => <option key={s} value={s}>{formatSeasonYear(s)}</option>)}</select></label></div>
      <div className="news-filter-chips">
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`news-chip news-chip-${cat.toLowerCase().replace(/\s/g, '')} ${active.has(cat) ? 'active' : ''}`}
            aria-pressed={active.has(cat)}
            onClick={() => toggle(cat)}
          >
            {cat}
          </button>
        ))}
        <button className="news-chip-all" onClick={() => setActive(new Set(ALL_CATEGORIES))}>All</button>
        <button className="news-chip-all" onClick={() => setActive(new Set())}>None</button>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state">Nothing to show — try enabling more categories, or check back after simulating some games.</p>
      ) : (
        <div className="news-feed-grid">
          {filtered.map((item) => (
            <div key={item.id} className="news-card">
              <div className="news-card-header">
                <span className="news-card-team team-name-logo">{item.teamId && <TeamLogo team={league.teams.find(t => t.teamId === item.teamId) ?? { teamId: item.teamId, name: item.teamName ?? item.teamId }} size={30} />}<TeamLink name={item.teamName ?? 'League'} /></span>
                <span className={`news-chip news-chip-${item.category.toLowerCase().replace(/\s/g, '')}`}>{item.category}</span>
              </div>
              <small className="news-season">{formatSeasonYear(item.season)}</small>
              <h3 className="news-card-body"><TeamText text={item.headline} /></h3>
              {item.detail && <p className="news-detail"><TeamText text={item.detail} /></p>}
              <div className="news-links">
                {item.playerId && onSelectPlayer && league.teams.some(t => t.seasons.some(p => p.playerId === item.playerId)) && <button onClick={() => onSelectPlayer(item.playerId!)}>Player Profile</button>}
                {item.gameId && item.possession != null && item.season === league.season && onWatchHighlight && <button className="primary" onClick={() => onWatchHighlight(item.gameId!, item.possession!)}>▶ Watch the Play</button>}
                {item.gameId && item.season === league.season && onGame && <button onClick={() => onGame(item.gameId!)}>View Game</button>}
                {item.postseason && item.season === league.season && onPlayoffs && <button onClick={onPlayoffs}>View Playoffs</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
