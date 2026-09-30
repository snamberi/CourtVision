import { useEffect, useMemo, useState } from 'react';
import { readFavorites, setFavorites, REAL_FRANCHISES, FAVORITES_EVENT, FAV_BOOST, type Favorites } from '../profile/favorites';
import { TeamLogo } from './TeamLogo';

interface Candidate { id: string; name: string; ovr: number; rarity: string }
const RARITY: Record<string, string> = { legendary: 'Star', epic: 'Great', rare: 'Good', common: 'Role' };

/** Your favourite team and player (the Profile tab). */
export function FavoritesPanel() {
  const [fav, setFav] = useState<Favorites>(() => readFavorites());
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { const bump = () => setFav(readFavorites()); window.addEventListener(FAVORITES_EVENT, bump); return () => window.removeEventListener(FAVORITES_EVENT, bump); }, []);
  const save = (next: Favorites) => { setFavorites(next); setFav(next); };

  // Every real player at his best season (the Career wheel's list), loaded the first time you search.
  const load = () => {
    if (players || loading) return;
    setLoading(true);
    Promise.all([import('../history/nbaHistoryData').then(m => m.loadNbaHistory()), import('../career/wheel')])
      .then(([h, w]) => setPlayers(w.wheelPool(h).map(c => ({ id: c.playerId, name: c.name, ovr: c.ovr, rarity: c.rarity })).sort((a, b) => b.ovr - a.ovr)))
      .catch(() => setPlayers([])).finally(() => setLoading(false));
  };
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q.length < 2 || !players ? [] : players.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, players]);
  const favPlayer = players?.find(p => p.id === fav.player);

  return <section className="locker-bay favorites-panel" aria-label="Your favourites">
    <h2>Your favourites</h2>
    <div className="fav-row">
      <label className="fav-field"><span>Favourite team</span>
        <span className="fav-team">{fav.team && <TeamLogo team={{ teamId: fav.team, name: REAL_FRANCHISES.find(t => t.id === fav.team)?.city ?? fav.team }} size={26} />}
          <select className="year-input" value={fav.team ?? ''} onChange={e => save({ ...fav, team: e.target.value || undefined })}>
            <option value="">None</option>
            {REAL_FRANCHISES.map(t => <option key={t.id} value={t.id}>{t.city} ({t.id})</option>)}
          </select></span>
        <small>Picked for you when you choose a team (real leagues, the All-Time Draft). You can still pick any other.</small>
      </label>
      <div className="fav-field"><span>Favourite player</span>
        {fav.player ? <span className="fav-chosen"><b>{favPlayer?.name ?? fav.player}</b>{favPlayer && <small>{RARITY[favPlayer.rarity]} · {favPlayer.ovr} OVR at his best</small>}
          <button className="link-button" onClick={() => save({ ...fav, player: undefined })}>Change</button></span>
          : <>
            <input className="year-input" value={query} placeholder={loading ? 'Loading every player…' : 'Search any player in NBA history'} onFocus={load} onChange={e => { setQuery(e.target.value); load(); }} aria-label="Search for your favourite player" />
            {hits.length > 0 && <ul className="fav-hits" role="listbox" aria-label="Players">{hits.map(p => <li key={p.id}><button role="option" aria-selected={false} onClick={() => { save({ ...fav, player: p.id }); setQuery(''); }}>
              <b>{p.name}</b><small>{RARITY[p.rarity]} · {p.ovr}</small></button></li>)}</ul>}
          </>}
        <small>When a Career Mode wheel or a League Hunt reel lands on his rarity, it is him {Math.round(FAV_BOOST * 100)}% more often, until you get him once in that run. The weekly career and the Daily Legend keep the same odds for everyone.</small>
      </div>
    </div>
  </section>;
}
