import { useState } from 'react';
import { encodeLeagueCode, describeOrigin, type LeagueOrigin } from '../retention/leagueCode';
import { track } from '../analytics/track';

/** "Challenge a friend": this league's code, to copy and send. */
export function LeagueCodeBox({ origin, teamId, teamName }: { origin: LeagueOrigin; teamId: string | null; teamName?: string }) {
  const code = encodeLeagueCode(origin, teamId);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const text = `Can you beat me? Start the same league in Court Vision with the code ${code} (${describeOrigin(origin, teamName)}).`;
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
    track('league_code', { action: 'copy', kind: origin.kind });
  };
  return <section className="league-code" aria-label="League code">
    <span className="pixel-eyebrow">CHALLENGE A FRIEND</span>
    <code>{code}</code>
    <button onClick={() => void copy()}>{copied ? 'Copied!' : 'Copy invite'}</button>
    <small>Friends who enter it under "Have a league code?" start this exact league{teamName ? ` as ${teamName}` : ''}: same rosters, draft classes and schedule.</small>
  </section>;
}
