import { useEffect, useState } from 'react';
import { cloudEnabled, useAccount } from '../../cloud/account';
import { loadBoard, type BoardResult } from '../../cloud/boards';
import { modeById, type ModeEntry } from '../../menu/modeCatalog';
import { challengeFor, CHALLENGE_INFO, readChallenge, today } from '../../retention/dailyChallenge';
import { modeOfWeek, FEATURED_NAME, bonusXp, readBonusLog, WEEKLY_BONUS_CAP } from '../../retention/modeOfWeek';
import { weeklyEvent } from '../../retention/weeklyEvent';
import { loadWeeklyRecords, weeklyCareer, weeklyRebuild, weeklyStreak, weekEndsAt, weekKey } from '../../retention/weekly';
import { readWeekLog } from '../../retention/weekLog';
import { formatPlayTime } from '../../retention/playTime';
import { noteSeason, SEASON_TIERS } from '../../retention/season';
import { activeHoliday, daysLeft, eventCoins, loadHoliday } from '../../retention/holiday';
import { WeeklyBoardDialog } from '../WeeklyBoard';
import { WeeklyRecap } from '../WeeklyRecap';
import { CodeAvatar } from '../AvatarFrame';
import { PixelIcon } from '../PixelIcon';
import { menuArt } from '../../menu/art';
import type { MenuDesign } from '../../menu/design';

function WeeklyLeaders({ week, onBoards }: { week: string; onBoards: () => void }) {
  const { userId, status } = useAccount();
  const key = [week, userId, status].join('/');
  const [result, setResult] = useState<{ key: string; board: BoardResult | 'error' } | null>(null);
  const board = result?.key === key ? result.board : null;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let current = true;
    if (cloudEnabled) {
      loadBoard({ kind: 'weekly', board: 'rebuild', week }, 3).then(
        data => { if (current) setResult({ key, board: data }); }, () => { if (current) setResult({ key, board: 'error' }); });
    }
    return () => { current = false; };
  }, [week, key]);
  return <><article className="arena-panel arena-leaders">
    <h2><PixelIcon name="podium" />Weekly leaderboard</h2>
    <small>Rebuild of the Week · Top 3</small>
    {board && board !== 'error' && board.rows.length ? <ol>{board.rows.map(row =>
      <li key={row.userId}><b>{row.rank}</b><CodeAvatar code={row.avatar} size={24} /><span>{row.username}</span><strong>{row.score.toLocaleString()} pts</strong></li>)}</ol>
      : <p role="status">{!cloudEnabled ? 'Online rankings are unavailable in this edition.' : board === 'error' ? 'The board is unavailable right now.' : !board ? 'Loading this week’s scores…' : 'The first finish this week takes the lead.'}</p>}
    {cloudEnabled && <button className="arena-text-link" onClick={() => setOpen(true)}>View weekly boards »</button>}
  </article>
    {open && <WeeklyBoardDialog onClose={() => setOpen(false)} onCommunity={onBoards} />}
  </>;
}

export function WeeklyHub({ design = 'fieldhouse', onOpen, onRebuild, onRewards, onBoards, busy, xp }: {
  design?: MenuDesign;
  onOpen: (e: ModeEntry) => void; onRebuild: () => void; onRewards: () => void; onBoards: () => void; busy: string | null; xp: number;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);
  const week = weekKey(now), rb = weeklyRebuild(week), cw = weeklyCareer(week), event = weeklyEvent(now);
  const feature = modeOfWeek(week), day = today(now), daily = challengeFor(day);
  const records = loadWeeklyRecords(), rec = records[week], log = readWeekLog()[week];
  const bonus = bonusXp(Object.fromEntries(Object.entries(readBonusLog()).filter(([, e]) => e?.week === week)));
  const pass = noteSeason(xp, now), holiday = activeHoliday(now);
  const left = Math.ceil((weekEndsAt(now) - now.getTime()) / 60_000);
  const launch = (id: string) => onOpen(modeById(id)!);
  const challenges = [
    { title: 'Rebuild of the Week', detail: `${rb.scenario.title} · ${rb.twist.label}`, status: rec?.rebuild ? `${rec.rebuild.best} pts` : 'Take the job', icon: 'hammer', go: onRebuild },
    { title: 'Career of the Week', detail: cw.draftYear ? `The ${cw.draftYear} draft class` : 'The current draft class', status: rec?.career ? `${rec.career.best} legacy` : 'Open career', icon: 'user', go: () => launch('career') },
    { title: 'Daily Challenge', detail: CHALLENGE_INFO[daily].title, status: readChallenge().days.includes(day) ? 'Completed' : '+1 Lucky Spin', icon: 'calendar', go: () => launch(daily === 'hunt' ? 'legends' : daily) },
  ];
  const stats = [
    ['Play time', formatPlayTime(log?.seconds ?? 0)],
    ['Finished runs', Object.values(log?.runs ?? {}).reduce((sum, n) => sum + n, 0)],
    ['New records', log?.records ?? 0],
    ['Weekly streak', `${weeklyStreak(records, now)} wk`],
  ];
  return <>
    <div className="arena-heading"><h1>Weekly hub</h1><div className="arena-clock"><PixelIcon name="clock" /><span>Week {Number(week.split('W')[1])}<small>{Math.floor(left / 1440)}d {Math.floor(left / 60) % 24}h {left % 60}m left</small></span></div></div>
    <div className="arena-week-grid">
      <article className="arena-panel arena-feature"><img src={menuArt('weekly', design)} alt="" /><div>
        <span className="arena-kicker">Mode of the week</span><h2>{FEATURED_NAME[feature]}</h2>
        <p>Earn double XP on finished runs this week.</p>
        <button className="arena-gold" disabled={!!busy} onClick={() => launch(feature)}>Play featured »</button>
      </div></article>
      <article className="arena-panel arena-challenges"><h2><PixelIcon name="calendar" />This week’s challenges</h2>
        {challenges.map(c => <button key={c.title} disabled={!!busy} onClick={c.go}><PixelIcon name={c.icon} /><span><b>{c.title}</b><small>{c.detail}</small></span><em>{c.status}</em></button>)}
      </article>
      <article className="arena-panel arena-rewards"><h2>Weekly rewards</h2><img src={menuArt('chest', design)} alt="" />
        <p>Season Pass · Tier {pass.tier} / {SEASON_TIERS}</p><button className="arena-gold" onClick={onRewards}>View rewards »</button></article>
      <WeeklyLeaders week={week} onBoards={onBoards} />
      <article className="arena-panel arena-progress"><h2><PixelIcon name="chart" />Your progress</h2><div>
        <span className="arena-medal"><PixelIcon name="trophy" size={45} /><b>2× XP</b></span>
        <div><strong>Weekly bonus XP</strong><progress aria-label="Weekly bonus XP" max={WEEKLY_BONUS_CAP} value={bonus.xp} /><small>{bonus.xp.toLocaleString()} / {WEEKLY_BONUS_CAP.toLocaleString()} XP</small></div>
      </div><p>{event.name} · {event.blurb}</p></article>
      <article className="arena-panel arena-week-stats"><h2><PixelIcon name="chart" />Weekly stats</h2>
        <dl>{stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article>
    </div>
    <div className="arena-week-extra"><button onClick={() => launch('legends')}>Daily Legend · League Hunt »</button>
      {holiday && <a href="#/event">{holiday.holiday.name} · {daysLeft(holiday, now)} days left · {eventCoins(loadHoliday(), holiday.key)} {holiday.holiday.coins} »</a>}</div>
    <WeeklyRecap />
  </>;
}
