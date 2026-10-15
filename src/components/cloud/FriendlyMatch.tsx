import { useState } from 'react';
import { useAccount, supa } from '../../cloud/account';
import { localGhost } from '../../cloud/pvp';
import { playPvp, validGhost, pvpEra, type Ghost } from '../../hunt/pvp';
import { ERAS } from '../../hunt/eras';
import type { SeriesGame } from '../../hunt/run';
import { openSignIn } from '../../cloud/signIn';

/**
 * A friendly 1v1 from someone's profile: your League Hunt PvP team (or your last hunt squad) against theirs, a
 * best-of-seven under a random era's rules. Unrated: it never moves either rating, so play it as often as you like.
 */
export function FriendlyMatch({ theirs, username }: { theirs: unknown; username: string }) {
  const acct = useAccount();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ games: SeriesGame[]; won: boolean; era: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (acct.status !== 'signedIn') return <div className="friendly"><button onClick={openSignIn}>Sign in to challenge @{username}</button></div>;
  const play = async () => {
    setBusy(true); setError(null); setOut(null);
    try {
      const h = await import('../../history/nbaHistoryData').then(m => m.loadNbaHistory());
      const client = await supa();
      const { data } = await client.from('hunt_ghosts').select('squad').eq('user_id', acct.userId!).maybeSingle();
      const mine = ((data as { squad?: Ghost } | null)?.squad ?? localGhost()) as Ghost | null;
      if (!mine || !validGhost(h, mine)) throw new Error('Finish a League Hunt first: your squad becomes your team.');
      if (!validGhost(h, theirs)) throw new Error(`@${username}'s team could not be read.`);
      const era = ERAS[Math.floor(Math.random() * ERAS.length)].id;
      const r = playPvp(h, mine, theirs, Math.floor(Math.random() * 1_000_000_000), era);
      setOut({ ...r, era });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  return <div className="friendly">
    <button className="primary" disabled={busy} onClick={() => void play()}>{busy ? 'Playing…' : out ? 'Rematch' : `Challenge @${username} to a 1v1`}</button>
    <small>Your hunt team vs theirs, best of seven. Friendly: no rating changes.</small>
    {error && <p className="backup-msg err" role="alert">{error}</p>}
    {out && <div className={`hunt-result ${out.won ? 'won' : 'lost'}`}><span className="pixel-eyebrow">{out.won ? 'YOU WON' : 'YOU LOST'} · {pvpEra(out.era).label}</span>
      <h3>{out.games.filter(g => g.won).length}-{out.games.filter(g => !g.won).length}</h3>
      <ol className="pvp-games">{out.games.map((g, i) => <li key={i} className={g.won ? 'won' : ''}>G{i + 1} {g.us}-{g.them} · {g.top}</li>)}</ol></div>}
  </div>;
}

/**
 * Your player against theirs, 1v1 to 11: both built in the Closet with the points each level earns (their profile
 * publishes their build). Counts for your 1v1 record; nothing is ranked.
 */
export function PlayerOneOnOne({ theirs, username, level }: { theirs: unknown; username: string; level: number }) {
  const [out, setOut] = useState<{ score: [number, number]; won: boolean; me: string; them: number } | null>(null);
  const play = async () => {
    const [{ playStreet, ratingsBaller, myBaller }, { cleanRatings }, one, { noteHolidayFinish }] = await Promise.all([
      import('../../arcade/street'), import('../../profile/myRatings'), import('../../arcade/oneOnOne'), import('../../retention/holiday')]);
    const mine = myBaller(), opp = ratingsBaller(cleanRatings(theirs, level), `@${username}`, `@${username}`);
    const g = playStreet([mine], [opp], 11, Math.floor(Math.random() * 1e9));
    const rec = one.loadOne(), won = g.winner === 0;
    noteHolidayFinish(won, one.eventTag(rec));
    one.saveOne(one.noteOne(rec, { kind: 'user', id: username }, won));
    setOut({ score: g.score, won, me: `${mine.ovr}`, them: opp.ovr });
  };
  return <div className="friendly">
    <button onClick={() => void play()}>{out ? 'Run it back' : `Your player vs @${username}'s, 1v1`}</button>
    <small>Your Closet player against theirs, first to 11. Just for fun.</small>
    {out && <div className={`hunt-result ${out.won ? 'won' : 'lost'}`}><span className="pixel-eyebrow">{out.won ? 'YOU WON' : 'YOU LOST'} · {out.me} OVR vs {out.them} OVR</span><h3>{out.score[0]}-{out.score[1]}</h3></div>}
  </div>;
}
