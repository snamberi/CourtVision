import { useEffect, useState } from 'react';
import type { League } from '../../simulation/league';
import type { GMLeagueExtras } from '../../simulation/gm';
import { calculateOverall } from '../../simulation/engine/overall';
import type { CareerMeta } from '../../career/career';
import { PixelIcon } from '../PixelIcon';

type Tools = { list: CareerMeta[]; mod: typeof import('../../career/importCareer') };

/**
 * Bring a Career Mode player into this league. In a normal league he joins free agency and signs wherever he wants,
 * like anyone; with Sandbox on he can go straight onto any team.
 */
export function CareerImportPanel({ league, extras, onChange, onToast, allowTeams }: {
  league: League; extras: GMLeagueExtras; onChange: (league: League, extras: GMLeagueExtras) => void;
  onToast?: (text: string, tone?: 'success' | 'error' | 'info') => void; allowTeams: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tools, setTools] = useState<Tools | null>(null);
  const [pick, setPick] = useState<string>('');
  const [stage, setStage] = useState<'rookie' | 'prime' | 'last'>('prime');
  const [teamId, setTeamId] = useState('');
  useEffect(() => {
    if (!open || tools) return;
    let live = true;
    Promise.all([import('../../career/storage'), import('../../career/importCareer')]).then(([s, mod]) => s.listCareers().then(list => { if (live) { setTools({ list: list.filter(m => m.years.length > 0), mod }); } }));
    return () => { live = false; };
  }, [open, tools]);
  const meta = tools?.list.find(m => m.id === pick) ?? tools?.list[0];
  const preview = meta && tools ? calculateOverall(tools.mod.careerPlayerAt(meta, stage, league.season ?? '')) : null;
  const doImport = () => {
    if (!tools || !meta) return;
    const r = tools.mod.importCareerPlayer(meta, stage, league, extras, allowTeams && teamId ? teamId : null);
    onChange(r.league, r.extras);
    onToast?.(`${r.playerId} joined ${allowTeams && teamId ? league.teams.find(t => t.teamId === teamId)?.name : 'free agency'}.`, 'success');
  };
  return <section className="sandbox-tool career-import">
    <h3><PixelIcon name="star" /> Bring in a Career Mode player</h3>
    {!open ? <><p className="hint-text">Your created players can play in this league too: as a rookie, at his prime, or as he was at the end.</p><button onClick={() => setOpen(true)}>Choose a player</button></>
      : !tools ? <p className="hint-text">Loading your careers…</p>
      : !tools.list.length ? <p className="hint-text">No careers with a season played yet. Play one in Career Mode first.</p>
      : <div className="sandbox-import-form">
        <label>Player <select value={meta?.id ?? ''} onChange={e => setPick(e.target.value)}>{tools.list.map(m => <option key={m.id} value={m.id}>{m.playerId} · {m.years.length} seasons{m.retired ? ` · retired, legacy ${m.retired.legacy}` : ''}</option>)}</select></label>
        <label>As <select value={stage} onChange={e => setStage(e.target.value as typeof stage)}>{(Object.keys(tools.mod.STAGE_LABEL) as (typeof stage)[]).map(s => <option key={s} value={s}>{tools.mod.STAGE_LABEL[s]}</option>)}</select></label>
        {allowTeams && <label>Add to <select value={teamId} onChange={e => setTeamId(e.target.value)}><option value="">Free agency</option>{league.teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}</select></label>}
        {preview != null && <p className="hint-text">He arrives at {preview} Overall.{allowTeams ? '' : ' He joins free agency: sign him before someone else does.'}</p>}
        <button className="primary" onClick={doImport}>Bring him in</button>
      </div>}
  </section>;
}
