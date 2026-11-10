import { RELICS, type RelicState } from '../../relics/relics';
import { mastered50, masteryNeed50, masteryTitle50 } from '../../relics/mastery50';
import { RelicArt } from './RelicArt';
export function RelicMastery50({ state }: { state: RelicState }) {
  const owned=RELICS.filter(r=>state.owned[r.id]);
  return <details className="relic-mastery50"><summary>Relic mastery · {owned.filter(r=>mastered50(state,r)).length} / {RELICS.length}</summary><p>Keep a relic equipped while completing rewarded runs in at least two modes and finding an Epic, Legendary, Mythic or Secret relic. Each mastered relic earns a gold frame and a profile title.</p><div className="relic-grid">{owned.map(r=>{const p=state.feats50?.[r.id],done=mastered50(state,r),modes=new Set(p?.runs.map(k=>k.split(':')[0])).size,need=masteryNeed50(r.rarity);return <article key={r.id} className={`relic-card ${done?'feat-mastered50':''}`}><RelicArt id={r.id} size={48}/><span><b>{r.name}</b><small>Rewarded finishes: {Math.min(need,p?.runs.length??0)} / {need}</small><small>Different modes: {Math.min(2,modes)} / 2</small><small>Epic or better draw: {Math.min(1,p?.rareDraws??0)} / 1</small><em>{done?`Unlocked: ${masteryTitle50(r.name)}`:'Reward: gold frame + profile title'}</em></span></article>;})}</div>{!owned.length&&<p>Collect your first relic to start.</p>}</details>;
}
