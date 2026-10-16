import { useState } from 'react';
import type { League } from '../simulation/league';
import { seasonText } from '../history/realDevelopment';
import '../improvements.css';

/* A five-step tour of what makes a real-history league different, shown on the dashboard the first time you open one. */

const DONE_KEY = 'cv-history-tour-done';
export const historyTourDone = () => { try { return localStorage.getItem(DONE_KEY) === '1'; } catch { return false; } };
const finish = () => { try { localStorage.setItem(DONE_KEY, '1'); } catch { /* storage blocked: the tour shows again next time */ } };

export function HistoryTour({ league, onNavigate, onClose }: { league: League; onNavigate: (tab: string, sub?: 'rules' | 'awards') => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const meta = league.historical;
  if (!meta) return null;
  const steps: { title: string; text: string; tab?: string; sub?: 'rules'; go?: string }[] = [
    { title: 'Real players, real careers', text: meta.realDevelopment
      ? `Every real player's ratings follow his real season-by-season career, so a rookie becomes a star when he really did. Training can't change that; minutes, morale and familiarity still matter.`
      : 'Real Player Development is off: real players grow through your coaching and training like everyone else.', tab: 'leagueSettings', sub: 'rules', go: 'League settings' },
    { title: 'Rosters', text: meta.forceRosters
      ? `Historical rosters is on: every AI team takes the floor with its real roster each season, real trades included.${meta.userTeamToo ? ' Your team follows its real roster too.' : ' Your team is yours.'}`
      : 'Rosters started real and now change through your league: trades, signings and drafts are up to the GMs, you included.', tab: 'roster', go: 'Roster' },
    { title: 'Each era plays like itself', text: league.settings.yearAccurate
      ? 'Seasons take their real length and pace. With era rules on, there is no 3-point line before 1979-80, hand-checking until 2003-04, and as many threes as teams really took.'
      : 'This league plays every season by today\'s rules.', tab: 'leagueSettings', sub: 'rules', go: 'Era settings' },
    { title: 'History up to the start', text: `Everything before ${seasonText(meta.startYear)} is real: champions, awards, careers. Look it up in NBA History. From the first game on, your league writes its own.`, tab: 'nbaArchive', go: 'NBA History' },
    { title: 'Real vs Yours', text: 'After each season, see how far your league has drifted from what really happened: champions, MVPs and #1 picks side by side.', tab: 'realVsYours', go: 'Real vs Yours' },
  ];
  const s = steps[step];
  const close = () => { finish(); onClose(); };
  return (
    <section className="history-tour" aria-label="Tour of this real-history league">
      <div className="history-tour-head"><span className="pixel-eyebrow">REAL NBA LEAGUE · {step + 1}/{steps.length}</span><button className="link-button" onClick={close} aria-label="Close the tour">Skip tour</button></div>
      <h3>{s.title}</h3>
      <p>{s.text}</p>
      <div className="history-tour-dots" aria-hidden>{steps.map((_, i) => <span key={i} className={i === step ? 'on' : ''} />)}</div>
      <div className="code-mode-actions">
        {step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}
        {s.tab && <button onClick={() => onNavigate(s.tab!, s.sub)}>{s.go}</button>}
        {step < steps.length - 1 ? <button className="primary" onClick={() => setStep(step + 1)}>Next</button> : <button className="primary" onClick={close}>Got it</button>}
      </div>
    </section>
  );
}
