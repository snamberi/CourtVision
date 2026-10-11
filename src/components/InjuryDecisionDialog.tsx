import { Modal } from './Modal';
import { PixelIcon } from './PixelIcon';
import type { League } from '../simulation/league';
import { pendingDecisions, treatmentOptions, type Treatment } from '../simulation/medical';

/**
 * When one of your players gets hurt, the doctors ask straight away: rush him back, the standard recovery, extra rest or
 * (severe injuries) surgery. "Decide later" leaves it in the Medical Room (undecided injuries heal on the standard timeline).
 */
export function InjuryDecisionDialog({ league, teamId, onChoose, onLater }: { league: League; teamId: string | null; onChoose: (playerId: string, t: Treatment) => void; onLater: () => void }) {
  const rec = pendingDecisions(league, teamId)[0];
  if (!rec) return null;
  const p = league.teams.find(t => t.teamId === rec.teamId)?.seasons.find(s => s.playerId === rec.playerId);
  return <Modal label="Injury decision" onClose={onLater} className="injury-decision">
    <span className="pixel-eyebrow"><PixelIcon name="heart" size={12} /> MEDICAL ROOM · {rec.severity.toUpperCase()} INJURY</span>
    <h2>{rec.playerId} is hurt</h2>
    <p className="hint-text">{p ? `Age ${p.age}. ` : ''}The doctors estimate {rec.totalGames} game{rec.totalGames === 1 ? '' : 's'} out. How do you want to handle it?</p>
    <div className="injury-options">{treatmentOptions(rec).map(o => <button key={o.id} className={o.id === 'standard' ? 'primary' : ''} onClick={() => onChoose(rec.playerId, o.id)}>
      <b>{o.label}</b><span>{o.games} game{o.games === 1 ? '' : 's'} out · {o.risk}</span><small>{o.detail}</small>
    </button>)}</div>
    <button className="link-button" onClick={onLater}>Decide later in the Medical Room</button>
  </Modal>;
}
