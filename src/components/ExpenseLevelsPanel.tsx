import { useState } from 'react';
import type { LeagueTeam, TeamExpenseLevels } from '../simulation/league';
import { defaultExpenseLevels, expenseAnnualCost, expenseEffects } from '../simulation/league';

interface Props {
  team: LeagueTeam;
  onSave: (teamId: string, levels: TeamExpenseLevels) => void;
}

type LevelKey = keyof TeamExpenseLevels;

const LEVEL_META: { key: LevelKey; label: string; help: string }[] = [
  { key: 'scouting', label: 'Scouting expense level', help: 'Sharpens how accurate a draft prospect\'s scouted potential is versus their true potential.' },
  { key: 'coaching', label: 'Coaching expense level', help: 'Boosts player development — more positive progressions, fewer negative ones.' },
  { key: 'health', label: 'Health expense level', help: 'Shortens how long injuries keep your players out.' },
  { key: 'facilities', label: 'Facilities expense level', help: 'Raises player mood and ticket demand.' },
];

function effectLines(key: LevelKey, level: number): string[] {
  const e = expenseEffects({ ...defaultExpenseLevels(), [key]: level });
  switch (key) {
    case 'scouting':
      return [`${Math.round(e.scoutingAccuracy * 100)}% scouting accuracy`];
    case 'coaching': {
      const pct = ((e.developmentMultiplier - 1) * 100).toFixed(2);
      return [`${Number(pct) >= 0 ? '+' : ''}${pct}% positive progs`, `${Number(pct) >= 0 ? '-' : '+'}${Math.abs(Number(pct)).toFixed(2)}% negative progs`];
    }
    case 'health': {
      const pct = ((e.injuryDurationMultiplier - 1) * 100).toFixed(2);
      return [`${pct}% injury duration`];
    }
    case 'facilities': {
      const demand = ((e.ticketDemandMultiplier - 1) * 100).toFixed(2);
      return [`${e.moodBonus >= 0 ? '+' : ''}${e.moodBonus.toFixed(1)} player mood`, `${Number(demand) >= 0 ? '+' : ''}${demand}% ticket demand`];
    }
  }
}

export function ExpenseLevelsPanel({ team, onSave }: Props) {
  const [levels, setLevels] = useState<TeamExpenseLevels>(team.expenseLevels ?? defaultExpenseLevels());
  const [saved, setSaved] = useState(false);

  const adjust = (key: LevelKey, delta: number) => {
    setSaved(false);
    setLevels((prev) => ({ ...prev, [key]: Math.max(0, Math.min(100, prev[key] + delta)) }));
  };

  const totalCost = LEVEL_META.reduce((sum, m) => sum + expenseAnnualCost(levels[m.key]), 0);

  return (
    <div className="expense-levels-panel">
      <h5 className="stats-subheading">Expense Levels</h5>
      <p className="hint-text">
        Budget dials your owner funds each season. Every level costs real money against revenue and buys a
        concrete effect — total annual spend is currently ${(totalCost / 1_000_000).toFixed(2)}M.
      </p>

      <div className="expense-levels-grid">
        {LEVEL_META.map((m) => {
          const level = levels[m.key];
          const projected = Math.max(0, Math.min(100, level + 15));
          return (
            <div key={m.key} className="expense-level-card">
              <span className="expense-level-label">{m.label}</span>
              <div className="expense-level-stepper">
                <button onClick={() => adjust(m.key, -5)} aria-label={`Lower ${m.label}`}>−</button>
                <span className="expense-level-value">{level}</span>
                <button onClick={() => adjust(m.key, 5)} aria-label={`Raise ${m.label}`}>+</button>
              </div>
              <span className="hint-text">Current annual cost: ${(expenseAnnualCost(level) / 1_000_000).toFixed(2)}M</span>
              <p className="hint-text expense-level-help">{m.help}</p>

              <div className="expense-effects">
                <div>
                  <span className="expense-effects-title">Current effect</span>
                  {effectLines(m.key, level).map((line, i) => (
                    <span key={i} className="expense-effect-chip">{line}</span>
                  ))}
                </div>
                <div>
                  <span className="expense-effects-title">At level {projected}</span>
                  {effectLines(m.key, projected).map((line, i) => (
                    <span key={i} className="expense-effect-chip projected">{line}</span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="primary" onClick={() => { onSave(team.teamId, levels); setSaved(true); }}>
        Save Expense Levels
      </button>
      {saved && <span className="hint-text expense-saved">Saved.</span>}
    </div>
  );
}
