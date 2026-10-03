import { useEffect, useMemo, useState } from 'react';
import { readFavorites, setFavorites, REAL_FRANCHISES, FAVORITES_EVENT, FAV_BOOST, type Favorites } from '../profile/favorites';
import { TeamLogo } from './TeamLogo';
import { PlayerAvatar } from './PlayerAvatar';

interface Candidate { id: string; name: string; ovr: number; rarity: string; team: string; end: number }
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
      .then(([h, w]) => setPlayers(w.wheelPool(h).map(c => ({ id: c.playerId, name: c.name, ovr: c.ovr, rarity: c.rarity, team: c.team, end: c.end })).sort((a, b) => b.ovr - a.ovr)))
      .catch(() => setPlayers([])).finally(() => setLoading(false));
  };
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q.length < 2 || !players ? [] : players.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, players]);
  const favPlayer = players?.find(p => p.id === fav.player);
  // Older saves kept only the id: fill in his name and team the first time the list is here.
  useEffect(() => { if (favPlayer && (!fav.playerName || !fav.playerTeam)) save({ ...fav, playerName: favPlayer.name, playerTeam: favPlayer.team }); }, [favPlayer?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (fav.player && !fav.playerName) load(); }, [fav.player]); // eslint-disable-line react-hooks/exhaustive-deps
  const favName = favPlayer?.name ?? fav.playerName;

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
        {fav.player ? <div className="fav-player-card">
          <span className="fav-player-art">{favName ? <PlayerAvatar playerId={favName} teamId={fav.playerTeam ?? favPlayer?.team} size={92} title={favName} /> : <span className="hint-text">Loading…</span>}</span>
          <span className="fav-chosen"><b>{favName ?? 'Loading…'}</b>{favPlayer && <small>{RARITY[favPlayer.rarity]} · {favPlayer.ovr} OVR at his best ({favPlayer.end - 1}-{String(favPlayer.end).slice(2)})</small>}
            <button className="link-button" onClick={() => save({ team: fav.team })}>Change</button></span>
        </div>
          : <>
            <input className="year-input" value={query} placeholder={loading ? 'Loading every player…' : 'Search any player in NBA history'} onFocus={load} onChange={e => { setQuery(e.target.value); load(); }} aria-label="Search for your favourite player" />
            {hits.length > 0 && <ul className="fav-hits" role="listbox" aria-label="Players">{hits.map(p => <li key={p.id}><button role="option" aria-selected={false} onClick={() => { save({ ...fav, player: p.id, playerName: p.name, playerTeam: p.team }); setQuery(''); }}>
              <PlayerAvatar playerId={p.name} teamId={p.team} mode="portrait" size={26} /><b>{p.name}</b><small>{RARITY[p.rarity]} · {p.ovr}</small></button></li>)}</ul>}
          </>}
        <small>When a Career Mode wheel or a League Hunt reel lands on his rarity, it is him {Math.round(FAV_BOOST * 100)}% more often, until you get him once in that run. The weekly career and the Daily Legend keep the same odds for everyone.</small>
      </div>
    </div>
  </section>;
}
