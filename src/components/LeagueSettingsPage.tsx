import { DEFAULT_MVP_WEIGHTS, DEFAULT_DPOY_WEIGHTS, DEFAULT_AWARD_SETTINGS, STAT_TITLE_SHARE, ROOKIE_GAMES_SHARE, gamesNeeded, type AwardSettings, type MVPFormulaWeights, type DPOYFormulaWeights } from '../simulation/awards';

export { DEFAULT_AWARD_SETTINGS, type AwardSettings };

interface Props {
  settings: AwardSettings;
  onChange: (settings: AwardSettings) => void;
  onSave?: () => void;
  /** Games each team plays this season, to show what the percentages mean. */
  seasonGames?: number;
}

function WeightSlider({ label, value, min, max, step, onChange, description }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; description?: string;
}) {
  return (
    <div className="league-rule-item">
      <label className="rating-row">
        <span className="rating-label">{label}</span>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <input
          type="number" className="rating-number" step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
      {description && <p className="league-rule-description">{description}</p>}
    </div>
  );
}

export function LeagueSettingsPage({ settings, onChange, onSave, seasonGames = 82 }: Props) {
  const setMvp = (key: keyof MVPFormulaWeights, v: number) => onChange({ ...settings, mvpWeights: { ...settings.mvpWeights, [key]: v } });
  const setDpoy = (key: keyof DPOYFormulaWeights, v: number) => onChange({ ...settings, dpoyWeights: { ...settings.dpoyWeights, [key]: v } });

  return (
    <div className="settings-page">
      <div className="code-mode-actions">
        <button className="primary" onClick={() => onSave?.()}>Save Settings</button>
      </div>
      <p className="hint-text">Every setting on this page applies immediately and is stored with this league. "Save Settings" saves the game now.</p>

      <section>
        <h4>Award Eligibility</h4>
        <div className="league-rule-item">
          <label className="rating-row">
            <span className="rating-label">Games needed (% of season)</span>
            <input type="range" min={0} max={100} step={1} value={Math.round(settings.minGamesShare * 100)} onChange={(e) => onChange({ ...settings, minGamesShare: Number(e.target.value) / 100 })} />
            <input type="number" className="rating-number" min={0} max={100} value={Math.round(settings.minGamesShare * 100)} onChange={(e) => onChange({ ...settings, minGamesShare: Math.max(0, Math.min(100, Number(e.target.value))) / 100 })} />
          </label>
          <p className="league-rule-description">
            MVP, Defensive Player, Sixth Man, Most Improved, Clutch and the All-League and All-Defense teams need {gamesNeeded(seasonGames, settings.minGamesShare)} of {seasonGames} games.
            Stat titles and the minor awards need {gamesNeeded(seasonGames, Math.min(settings.minGamesShare, STAT_TITLE_SHARE))}; Rookie of the Year and All-Rookie need {gamesNeeded(seasonGames, Math.min(settings.minGamesShare, ROOKIE_GAMES_SHARE))}.
            During the season the minimum is pro-rated to the games played so far. Default: 79% (65 of 82).
          </p>
        </div>
        <div className="league-rule-item">
          <label className="rating-row">
            <span className="rating-label">All-Star count</span>
            <input type="range" min={4} max={40} step={2} value={settings.allStarCount} onChange={(e) => onChange({ ...settings, allStarCount: Number(e.target.value) })} />
            <input type="number" className="rating-number" value={settings.allStarCount} onChange={(e) => onChange({ ...settings, allStarCount: Number(e.target.value) })} />
          </label>
          <p className="league-rule-description">How many players are selected for the All-Star Game — half from each conference when the league has conferences.</p>
        </div>
      </section>

      <section>
        <h4>MVP Formula</h4>
        <p className="hint-text">Score = ppg·W + apg·W + rpg·W + spg·W + bpg·W + tov·W (usually negative) + team win%·W + efficiency·W + Win Shares (82-game pace)·W. The 100-member panel votes on these scores.</p>
        <WeightSlider label="Points" value={settings.mvpWeights.ppg} min={-5} max={5} step={0.1} onChange={(v) => setMvp('ppg', v)} description="How many MVP-score points each point-per-game is worth." />
        <WeightSlider label="Assists" value={settings.mvpWeights.apg} min={-5} max={5} step={0.1} onChange={(v) => setMvp('apg', v)} description="How many MVP-score points each assist-per-game is worth." />
        <WeightSlider label="Rebounds" value={settings.mvpWeights.rpg} min={-5} max={5} step={0.1} onChange={(v) => setMvp('rpg', v)} description="How many MVP-score points each rebound-per-game is worth." />
        <WeightSlider label="Steals" value={settings.mvpWeights.spg} min={-5} max={5} step={0.1} onChange={(v) => setMvp('spg', v)} description="How many MVP-score points each steal-per-game is worth." />
        <WeightSlider label="Blocks" value={settings.mvpWeights.bpg} min={-5} max={5} step={0.1} onChange={(v) => setMvp('bpg', v)} description="How many MVP-score points each block-per-game is worth." />
        <WeightSlider label="Turnovers" value={settings.mvpWeights.tov} min={-5} max={5} step={0.1} onChange={(v) => setMvp('tov', v)} description="How many MVP-score points each turnover-per-game costs (usually a negative weight)." />
        <WeightSlider label="Team win%" value={settings.mvpWeights.teamWinPct} min={0} max={30} step={0.5} onChange={(v) => setMvp('teamWinPct', v)} description="How much a player's own team's win percentage boosts their MVP score." />
        <WeightSlider label="Efficiency (EFF)" value={settings.mvpWeights.efficiency} min={-2} max={2} step={0.05} onChange={(v) => setMvp('efficiency', v)} description="How much overall statistical efficiency (EFF rating) factors into the MVP score." />
        <WeightSlider label="Win Shares" value={settings.mvpWeights.winShares ?? DEFAULT_MVP_WEIGHTS.winShares!} min={0} max={5} step={0.1} onChange={(v) => setMvp('winShares', v)} description="How many MVP-score points each Win Share is worth (projected to a full 82-game season)." />
        <button onClick={() => onChange({ ...settings, mvpWeights: { ...DEFAULT_MVP_WEIGHTS } })}>Reset MVP Formula</button>
      </section>

      <section>
        <h4>Defensive Player of the Year Formula</h4>
        <p className="hint-text">Score = spg·W + bpg·W + rpg·W + defensiveIQ·W + Defensive Win Shares (82-game pace)·W.</p>
        <WeightSlider label="Steals" value={settings.dpoyWeights.spg} min={-5} max={10} step={0.1} onChange={(v) => setDpoy('spg', v)} description="How many DPOY-score points each steal-per-game is worth." />
        <WeightSlider label="Blocks" value={settings.dpoyWeights.bpg} min={-5} max={10} step={0.1} onChange={(v) => setDpoy('bpg', v)} description="How many DPOY-score points each block-per-game is worth." />
        <WeightSlider label="Rebounds" value={settings.dpoyWeights.rpg} min={-2} max={2} step={0.05} onChange={(v) => setDpoy('rpg', v)} description="How many DPOY-score points each rebound-per-game is worth." />
        <WeightSlider label="Defensive Win Shares" value={settings.dpoyWeights.defensiveWinShares ?? DEFAULT_DPOY_WEIGHTS.defensiveWinShares!} min={0} max={6} step={0.1} onChange={(v) => setDpoy('defensiveWinShares', v)} description="How many DPOY-score points each Defensive Win Share is worth (projected to a full 82-game season)." />
        <WeightSlider label="Defensive IQ" value={settings.dpoyWeights.defensiveIQ} min={-1} max={1} step={0.01} onChange={(v) => setDpoy('defensiveIQ', v)} description="How much a player's raw Defensive IQ attribute factors into the DPOY score." />
        <button onClick={() => onChange({ ...settings, dpoyWeights: { ...DEFAULT_DPOY_WEIGHTS } })}>Reset DPOY Formula</button>
      </section>

      <p className="hint-text">
        These formulas are what the voting panel reads for MVP and Defensive Player of the Year, and they rank the
        candidates for the All-League, All-Defense and projected All-Star teams — on the Awards page, the weekly ladder and at season's end.
      </p>
    </div>
  );
}
