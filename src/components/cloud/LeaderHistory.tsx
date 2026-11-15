import { useEffect, useState } from 'react';
import { supa } from '../../cloud/account';
interface Reign { id: number; username: string; started_at: string; ended_at: string | null }
export function LeaderHistory({ board, onUser }: { board: string; onUser: (name: string) => void }) {
  const [now] = useState(() => Date.now());
  const [rows, setRows] = useState<Reign[]>([]);
  const [status, setStatus] = useState('Loading history…');
  useEffect(() => {
    let alive = true;
    void supa().then(client => client.from('leader_reigns_public').select('*').eq('board', board).order('started_at', { ascending: false }).limit(100)).then(({ data, error }) => {
      if (!alive) return;
      setRows((data ?? []) as Reign[]); setStatus(error ? 'History is not available yet.' : 'History begins when this release’s database migration is enabled.');
    }).catch(() => { if (alive) setStatus('History could not be loaded.'); });
    return () => { alive = false; };
  }, [board]);
  return <details className="leader-history"><summary>#1 history · time at the top</summary><p className="hint-text">{status} Ties use account ID order. Current reign duration is measured when this panel renders.</p>
    <ol>{rows.map(r => { const minutes = Math.max(0, Math.floor(((r.ended_at ? Date.parse(r.ended_at) : now) - Date.parse(r.started_at)) / 60000)); return <li key={r.id}><button className="link-button" onClick={() => onUser(r.username)}>@{r.username}</button> · {Math.floor(minutes / 1440)}d {Math.floor(minutes / 60) % 24}h {minutes % 60}m {r.ended_at ? '' : '· current #1'} <small>since {new Date(r.started_at).toLocaleDateString()}</small></li>; })}</ol>
  </details>;
}
