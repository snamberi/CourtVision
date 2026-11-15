const TIERS = ['Prospect', 'Contender', 'All-Star', 'Champion', 'Legend'];
/** Named road divisions describe existing progress without moving rewards or removing unlocks. */
export function RoadTier({ completed, total }: { completed: number; total: number }) {
  const fraction = Math.max(0,Math.min(1,completed/Math.max(1,total)));
  const tier = Math.min(4,Math.floor(fraction*5));
  return <section className="road-tier" aria-label="Road division"><strong>{TIERS[tier]}</strong><span>{completed} / {total} milestones unlocked</span><progress max={total || 1} value={completed} aria-label="Road completion" /><small>{fraction===1?'Road complete':tier===4?'Final division · finish the remaining milestones':`Next division: ${TIERS[Math.min(4,tier+1)]} · ${Math.ceil(Math.min(1,(tier+1)/5)*total)} milestones`}</small><ol>{TIERS.map((name,i)=><li key={name} aria-current={i===tier?'step':undefined} className={i<=tier?'unlocked':''}>{name}</li>)}</ol></section>;
}
