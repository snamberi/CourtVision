import type { PlayerSeason } from '../simulation/types';
import { HAIR_STYLES, BEARD_STYLES, HAT_STYLES, SKIN_TONES, HAIR_COLORS, HAT_COLORS, playerTraits, type Appearance } from '../visuals/playerSprite';
import { actionSprite, POSES, SPRITE_W, SPRITE_H } from '../visuals/actionSprites';
import { teamColors } from '../simulation/teamColors';
import { useTeamIdentity } from '../visuals/TeamIdentityContext';
import { PlayerAvatar } from './PlayerAvatar';

/** "hairStyle" → "Hair style", "afroFlatTop" → "Afro flat top". */
const label = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).replace(/ ([A-Z])/g, (_, c: string) => ` ${c.toLowerCase()}`);

function Swatches({ colors, value, onPick, name }: { colors: readonly string[]; value: number; onPick: (i: number) => void; name: string }) {
  return <div className="look-swatches" role="radiogroup" aria-label={name}>
    {colors.map((c, i) => <button key={c} type="button" role="radio" aria-checked={i === value} aria-label={`${name} ${i + 1}`} className={i === value ? 'on' : ''} style={{ background: c }} onClick={() => onPick(i)} />)}
  </div>;
}

/** Edit Player → Look: skin, hair, facial hair and headwear, with the portrait and an in-game frame as a live preview. */
export function AppearancePanel({ season, onChange }: { season: PlayerSeason; onChange: (next: PlayerSeason) => void }) {
  const look = season.appearance ?? {};
  const t = playerTraits(season.playerId, look);
  const identity = useTeamIdentity(season.teamId);
  const kit = identity ?? teamColors(season.teamId);
  const set = (patch: Appearance) => onChange({ ...season, appearance: { ...look, ...patch } });
  const index = (list: readonly string[], v: string) => Math.max(0, list.indexOf(v));
  const frame = actionSprite('LOOK', POSES.JUMPER[3], { playerId: season.playerId, primary: kit.primary, secondary: kit.secondary, jerseyNumber: season.jerseyNumber, age: season.age, appearance: look });
  return <div className="look-panel">
    <div className="look-preview">
      <PlayerAvatar playerId={season.playerId} teamId={season.teamId} jerseyNumber={season.jerseyNumber} age={season.age} appearance={look} size={96} />
      <svg width={SPRITE_W * 2} height={SPRITE_H * 2} viewBox={`0 0 ${SPRITE_W} ${SPRITE_H}`} shapeRendering="crispEdges" role="img" aria-label="On the court">{frame.map(p => <path key={p.fill} fill={p.fill} d={p.d} />)}</svg>
    </div>
    <div className="look-fields">
      <label>Skin tone<Swatches name="Skin tone" colors={SKIN_TONES} value={index(SKIN_TONES, t.skin)} onPick={i => set({ skin: i })} /></label>
      <label>Hair<select value={t.hairStyle} onChange={e => set({ hairStyle: e.target.value as Appearance['hairStyle'] })}>{HAIR_STYLES.map(h => <option key={h} value={h}>{label(h)}</option>)}</select></label>
      <label>Hair colour<Swatches name="Hair colour" colors={HAIR_COLORS} value={index(HAIR_COLORS, t.hair)} onPick={i => set({ hairColor: i })} /></label>
      <label>Facial hair<select value={t.beardStyle} onChange={e => set({ beardStyle: e.target.value as Appearance['beardStyle'] })}>{BEARD_STYLES.map(b => <option key={b} value={b}>{b === 'none' ? 'None' : label(b)}</option>)}</select></label>
      <label>Headwear<select value={t.hatStyle ?? 'none'} onChange={e => set({ hatStyle: e.target.value as Appearance['hatStyle'] })}><option value="none">None</option>{HAT_STYLES.map(h => <option key={h} value={h}>{label(h)}</option>)}</select></label>
      {t.hatStyle && <label>Headwear colour<Swatches name="Headwear colour" colors={HAT_COLORS} value={index(HAT_COLORS, t.hatColor)} onPick={i => set({ hatColor: i })} /></label>}
      {season.appearance && <button type="button" className="link-button" onClick={() => { const next = { ...season }; delete next.appearance; onChange(next); }}>Back to his original look</button>}
    </div>
  </div>;
}
