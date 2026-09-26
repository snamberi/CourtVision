import type { PlayerSeason } from '../simulation/types';
import { RatingSlider } from './RatingSlider';

interface Props {
  season: PlayerSeason;
  onChange: (next: PlayerSeason) => void;
  sandboxMode: boolean;
}

export function StarPlayerEditor({ season, onChange, sandboxMode }: Props) {
  const max = sandboxMode ? 200 : 99;
  const update = (patch: Partial<PlayerSeason>) => onChange({ ...season, ...patch });

  return (
    <div className="editor-panel">
      <h3>{season.playerId} — Player Editor</h3>

      <section>
        <h4>Offense</h4>
        <RatingSlider
          label="Ball Handling" max={max} value={season.attributes.offense.ballHandling}
          onChange={(v) => update({ attributes: { ...season.attributes, offense: { ...season.attributes.offense, ballHandling: v } } })}
          hint="How technically skilled the player is at controlling the ball."
        />
        <RatingSlider
          label="Ball Security" max={max} value={season.attributes.offense.ballSecurity}
          onChange={(v) => update({ attributes: { ...season.attributes, offense: { ...season.attributes.offense, ballSecurity: v } } })}
          hint="How difficult it is to strip the ball from this player."
        />
        <RatingSlider
          label="3PT" max={max} value={season.attributes.offense.threePoint}
          onChange={(v) => update({
            attributes: {
              ...season.attributes,
              offense: {
                ...season.attributes.offense,
                threePoint: v, corner3: v, aboveBreak3: v, pullUp3: v, catchAndShoot: v,
              },
            },
          })}
          hint="Overall three-point shooting ability (drives corner/above-break/pull-up/catch-and-shoot together for this quick control)."
        />
      </section>

      <section>
        <h4>Tendencies</h4>
        <RatingSlider
          label="3PT Tendency" max={200} value={season.tendencies.shot.aboveBreak3 + season.tendencies.shot.corner3 + season.tendencies.shot.pullUp3 + season.tendencies.shot.catchAndShoot3}
          onChange={(v) => update({
            tendencies: {
              ...season.tendencies,
              shot: { ...season.tendencies.shot, aboveBreak3: v / 4, corner3: v / 4, pullUp3: v / 4, catchAndShoot3: v / 4 },
            },
          })}
          hint="How often, relative to other shot types, this player wants to shoot threes."
        />
        <RatingSlider
          label="Target 3PA (per game)" max={40} value={season.tendencies.threePointTargets?.target ?? 0}
          onChange={(v) => update({ tendencies: { ...season.tendencies, threePointTargets: { ...season.tendencies.threePointTargets, target: v } } })}
          hint="Explicit user override the engine must respect: desired three-point attempts per game."
        />
        <RatingSlider
          label="Ball Dominance" max={100} value={season.tendencies.ballDominance}
          onChange={(v) => update({ tendencies: { ...season.tendencies, ballDominance: v } })}
          hint="How much the offense flows through this player, independent of usage/shot volume."
        />
        <label className="rating-row">
          <span className="rating-label">Primary Ball Handler</span>
          <input
            type="checkbox"
            checked={season.ballHandlerPriority >= 85}
            onChange={(e) => update({ ballHandlerPriority: e.target.checked ? 95 : 40 })}
          />
        </label>
      </section>

      <section>
        <h4>Minutes</h4>
        <label className="rating-row">
          <span className="rating-label">Mode</span>
          <select
            value={season.minutes.mode}
            onChange={(e) => update({ minutes: { ...season.minutes, mode: e.target.value as PlayerSeason['minutes']['mode'] } })}
          >
            <option value="AI">AI</option>
            <option value="TARGET">Target</option>
            <option value="EXACT">Exact</option>
            <option value="MANUAL">Manual</option>
          </select>
        </label>
        <RatingSlider
          label="Target Minutes" max={48} value={season.minutes.target}
          onChange={(v) => update({ minutes: { ...season.minutes, target: v } })}
        />
      </section>

      <section>
        <h4>Badges (sandbox-only for experimental)</h4>
        <label className="rating-row">
          <span className="rating-label">Perfect Shooter</span>
          <input
            type="checkbox"
            disabled={!sandboxMode}
            checked={season.badges.includes('perfect_shooter')}
            onChange={(e) => update({ badges: toggle(season.badges, 'perfect_shooter', e.target.checked) })}
          />
        </label>
        <label className="rating-row">
          <span className="rating-label">Never Turnover</span>
          <input
            type="checkbox"
            disabled={!sandboxMode}
            checked={season.badges.includes('never_turnover')}
            onChange={(e) => update({ badges: toggle(season.badges, 'never_turnover', e.target.checked) })}
          />
        </label>
        <label className="rating-row">
          <span className="rating-label">Infinite Stamina</span>
          <input
            type="checkbox"
            disabled={!sandboxMode}
            checked={season.badges.includes('infinite_stamina')}
            onChange={(e) => update({ badges: toggle(season.badges, 'infinite_stamina', e.target.checked) })}
          />
        </label>
        {!sandboxMode && <p className="hint-text">Enable Sandbox Mode to equip experimental badges.</p>}
      </section>

      <section>
        <h4>Development</h4>
        <RatingSlider
          label="Potential" max={sandboxMode ? 200 : 99} value={season.development.potential}
          onChange={(v) => update({ development: { ...season.development, potential: v } })}
          hint="Independent of current Overall — how good this player can eventually become."
        />
      </section>
    </div>
  );
}

function toggle(arr: string[], id: string, on: boolean) {
  return on ? [...new Set([...arr, id])] : arr.filter((b) => b !== id);
}
