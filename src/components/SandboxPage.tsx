import { PixelIcon } from './PixelIcon';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { ImportHistoryPanel, StickyPanel } from './SandboxTools';
export function SandboxPage({ enabled, onToggle, league, extras, onChange, onToast }: { enabled: boolean; onToggle: () => void; league?: League; extras?: GMLeagueExtras;
  onChange?: (league: League, extras: GMLeagueExtras) => void; onToast?: (text: string, tone?: 'success' | 'error' | 'info') => void }) {
  return <section className="sandbox-page"><span className="pixel-eyebrow">LEAGUE CONTROL</span><h2><PixelIcon name="settings" size={28} /> Sandbox Mode</h2>
    <p>Take full control of your league, or play as your team’s general manager.</p>
    <button className={`sandbox-switch ${enabled ? 'enabled' : ''}`} role="switch" aria-checked={enabled} onClick={onToggle}><PixelIcon name={enabled ? 'unlock' : 'lock'} /> Sandbox Mode: {enabled ? 'On' : 'Off'}</button>
    <ul><li>Edit player ratings, identities, tendencies, development and badges.</li><li>Manage any team’s coaching, roster and free-agent signings.</li><li>Use God Mode, Fast Edit, Bulk Editor, Code Mode, Import/Export and the Simulation Lab.</li><li>Use expanded ratings and experimental badges supported by the simulator.</li></ul>
    <p>Turning Sandbox off locks these tools again. It does not undo edits, trades or signings made while it was on.</p>
    <p className="hint-text">This setting is saved separately for each league. Auto Play, player profiles, read-only team profiles and save backups remain available when Sandbox is off.</p>
    {enabled && league && extras && onChange && <>
      <ImportHistoryPanel league={league} extras={extras} onChange={onChange} onToast={onToast} />
      <StickyPanel league={league} extras={extras} onChange={onChange} onToast={onToast} />
    </>}
  </section>;
}
