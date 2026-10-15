import { useEffect, useState } from 'react';
import { PixelIcon } from '../PixelIcon';
import { MyFramedAvatar } from '../AvatarFrame';
import { totalXp, levelFor } from '../../profile/profile';
import { feetInches } from '../../career/categories';
import {
  MY_SKILLS, BASE_RATING, BASE_HEIGHT, MAX_RATING, MAX_HEIGHT, ELITE_FROM, ELITE_SLOTS, INCH_COST, POINTS_PER_STEP, LEVELS_PER_STEP,
  loadMyRatings, saveMyRatings, stepSkill, stepHeight, raiseBlock, heightBlock, pointsLeft, pointsEarned, eliteCount, myOverall, baseRatings, MY_RATINGS_EVENT, type MySkill,
} from '../../profile/myRatings';
import { PETS, PET_COLORS, PET_ACCESSORIES, loadPets, savePets, equipPet, setLook, lookOf, petOpen, PETS_EVENT, SECOND_PRICE, PET_SECOND, secondOpen, secondBlurb, withSecond, type PetId } from '../../profile/pets';
import { loadRelics, saveRelics, spendCoins, RELICS_EVENT } from '../../relics/relics';
import { PetSprite } from './PetSprite';
import './playerPets.css';

const useLevel = () => useState(() => levelFor(totalXp()).level)[0];

/** Your own player's ratings: spend the points your level earns. */
export function MyRatingsPanel() {
  const level = useLevel();
  const [r, setR] = useState(() => loadMyRatings(level));
  useEffect(() => { const sync = () => setR(loadMyRatings(level)); window.addEventListener(MY_RATINGS_EVENT, sync); return () => window.removeEventListener(MY_RATINGS_EVENT, sync); }, [level]);
  const commit = (next: typeof r) => { if (next !== r) { setR(next); saveMyRatings(next); } };
  const left = pointsLeft(r, level), elite = eliteCount(r);
  const nextAt = (Math.floor(level / LEVELS_PER_STEP) + 1) * LEVELS_PER_STEP;
  return <section className="locker-bay my-ratings">
    <div className="my-ratings-head">
      <MyFramedAvatar size={88} title="Your player" />
      <div>
        <span className="pixel-eyebrow">YOUR PLAYER</span>
        <h2>{myOverall(r)} <small>OVR</small></h2>
        <p>{feetInches(r.height)} · Level {level} · <b>{left}</b> point{left === 1 ? '' : 's'} to spend · {POINTS_PER_STEP} more at level {nextAt}</p>
        <p className="hint-text">Everyone starts at {feetInches(BASE_HEIGHT)} with every skill at {BASE_RATING}. You earn {POINTS_PER_STEP} points every {LEVELS_PER_STEP} levels ({pointsEarned(level)} so far). A point is +1 to a skill (up to {MAX_RATING}); an inch of height costs {INCH_COST}. Only {ELITE_SLOTS} skills can be rated {ELITE_FROM}+ ({elite} now). Your player plays 3v3 Street with these ratings.</p>
      </div>
    </div>
    <ul className="my-ratings-list">
      <li>
        <span><b>Height</b><small>{INCH_COST} points an inch</small></span>
        <button aria-label="One inch shorter" disabled={r.height <= BASE_HEIGHT} onClick={() => commit(stepHeight(r, -1, level))}>−</button>
        <output>{feetInches(r.height)}</output>
        <button aria-label="One inch taller" disabled={!!heightBlock(r, level)} title={heightBlock(r, level) ?? undefined} onClick={() => commit(stepHeight(r, 1, level))}>+</button>
        <i className="my-ratings-bar" aria-hidden="true"><em style={{ width: `${(r.height - BASE_HEIGHT) / (MAX_HEIGHT - BASE_HEIGHT) * 100}%` }} /></i>
      </li>
      {MY_SKILLS.map(s => {
        const v = r.skills[s.id], block = raiseBlock(r, s.id as MySkill, level);
        return <li key={s.id} className={v >= ELITE_FROM ? 'elite' : ''}>
          <span><b>{s.name}</b><small>{v >= ELITE_FROM ? 'Elite' : s.short}</small></span>
          <button aria-label={`Lower ${s.name}`} disabled={v <= BASE_RATING} onClick={() => commit(stepSkill(r, s.id, -1, level))}>−</button>
          <output>{v}</output>
          <button aria-label={`Raise ${s.name}`} disabled={!!block} title={block ?? undefined} onClick={() => commit(stepSkill(r, s.id, 1, level))}>+</button>
          <i className="my-ratings-bar" aria-hidden="true"><em style={{ width: `${(v / MAX_RATING) * 100}%` }} /></i>
        </li>;
      })}
    </ul>
    <button onClick={() => commit(baseRatings())} disabled={left === pointsEarned(level)}><PixelIcon name="shuffle" size={14} /> Reset and get every point back</button>
  </section>;
}

/** Pets: pick one to bring along, and dress each one up. */
export function PetsPanel() {
  const level = useLevel();
  const [s, setS] = useState(loadPets);
  const [focus, setFocus] = useState<PetId>(() => loadPets().equipped ?? 'cat');
  useEffect(() => { const sync = () => setS(loadPets()); window.addEventListener(PETS_EVENT, sync); return () => window.removeEventListener(PETS_EVENT, sync); }, []);
  const commit = (next: typeof s) => { if (next !== s) { setS(next); savePets(next); } };
  const [coins, setCoins] = useState(() => loadRelics().coins);
  useEffect(() => { const sync = () => setCoins(loadRelics().coins); window.addEventListener(RELICS_EVENT, sync); return () => window.removeEventListener(RELICS_EVENT, sync); }, []);
  /** Pays for a pet's second ability out of your relic coins. */
  const unlockSecond = (id: PetId) => {
    const paid = spendCoins(loadRelics(), SECOND_PRICE, `${PETS.find(p => p.id === id)!.name}: ${PET_SECOND[id].name}`);
    if (!paid) return;
    saveRelics(paid); setCoins(paid.coins); commit(withSecond(loadPets(), id));
  };
  const pet = PETS.find(p => p.id === focus)!, look = lookOf(s, focus), open = petOpen(focus, level);
  return <section className="locker-bay pets-panel">
    <p className="hint-text">Bring one pet along. Each pet has its own ability; new pets open as your level climbs. Abilities never count in Dailies, Weeklies or duels, so those stay fair.</p>
    <div className="pets-grid" role="radiogroup" aria-label="Pets">
      {PETS.map(p => { const o = petOpen(p.id, level); return <button key={p.id} role="radio" aria-checked={focus === p.id} className={`pet-pick ${focus === p.id ? 'selected' : ''} ${o ? '' : 'locked'} ${s.equipped === p.id ? 'equipped' : ''}`} onClick={() => setFocus(p.id)}>
        <PetSprite id={p.id} look={lookOf(s, p.id)} size={48} />
        <b>{lookOf(s, p.id).name}</b>
        <small>{s.equipped === p.id ? 'With you' : o ? p.name : `Level ${p.level}`}</small>
      </button>; })}
    </div>
    <div className="pet-detail">
      <div className="pet-stage"><PetSprite id={focus} look={look} size={128} title={`${look.name} the ${pet.name.toLowerCase()}`} /></div>
      <div className="pet-info">
        <span className="pixel-eyebrow">{pet.name.toUpperCase()} · {pet.mode.toUpperCase()}</span>
        <h3>{look.name}</h3>
        <p><b>{pet.ability}</b></p>
        <p className="hint-text">{pet.blurb}</p>
        <div className={`pet-second ${secondOpen(s, focus) ? 'on' : ''}`}>
          <span className="pixel-eyebrow">SECOND ABILITY</span>
          <p>{secondBlurb(focus)}</p>
          {secondOpen(s, focus) ? <small><PixelIcon name="check" size={12} /> Unlocked{s.equipped === focus ? ' and working' : ': bring this pet along to use it'}.</small>
            : <button onClick={() => unlockSecond(focus)} disabled={!open || coins < SECOND_PRICE} title={!open ? `Opens at level ${pet.level}` : coins < SECOND_PRICE ? `You have ${coins.toLocaleString()} coins` : undefined}>
              <PixelIcon name="unlock" size={14} /> Unlock for {SECOND_PRICE.toLocaleString()} coins</button>}
        </div>
        {open
          ? <div className="contest-actions">
            {s.equipped === focus ? <button onClick={() => commit(equipPet(s, null, level))}>Leave at home</button> : <button className="primary" onClick={() => commit(equipPet(s, focus, level))}><PixelIcon name="heart" size={14} /> Bring {look.name} along</button>}
          </div>
          : <p className="pet-locked"><PixelIcon name="lock" size={12} /> Opens at level {pet.level} (you are level {level}).</p>}
        <label className="pet-field">Name <input className="year-input" value={look.name} maxLength={16} onChange={e => commit(setLook(s, focus, { name: e.target.value }))} onBlur={e => { if (!e.target.value.trim()) commit(setLook(s, focus, { name: pet.name })); }} /></label>
        <div className="pet-field"><span>Colour</span><div className="pet-swatches" role="radiogroup" aria-label="Colour">{PET_COLORS.map(c => <button key={c.id} role="radio" aria-checked={look.color === c.css} aria-label={c.name} title={c.name} className={look.color === c.css ? 'selected' : ''} style={{ background: c.css }} onClick={() => commit(setLook(s, focus, { color: c.css }))} />)}</div></div>
        <div className="pet-field"><span>Wearing</span><div className="pet-accessories" role="radiogroup" aria-label="Accessory">{PET_ACCESSORIES.map(a => <button key={a.id} role="radio" aria-checked={look.accessory === a.id} className={look.accessory === a.id ? 'selected' : ''} onClick={() => commit(setLook(s, focus, { accessory: a.id }))}>{a.name}</button>)}</div></div>
        {look.accessory !== 'none' && look.accessory !== 'shades' && look.accessory !== 'crown' && <div className="pet-field"><span>Accessory colour</span><div className="pet-swatches" role="radiogroup" aria-label="Accessory colour">{PET_COLORS.map(c => <button key={c.id} role="radio" aria-checked={look.accent === c.css} aria-label={c.name} title={c.name} className={look.accent === c.css ? 'selected' : ''} style={{ background: c.css }} onClick={() => commit(setLook(s, focus, { accent: c.css }))} />)}</div></div>}
      </div>
    </div>
  </section>;
}
