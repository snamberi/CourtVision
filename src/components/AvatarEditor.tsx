import { useMemo, useState } from 'react';
import { AVATAR_CATEGORIES, saveAvatar, randomAvatar, avatarHow, type AvatarCategory, type AvatarItem, type AvatarLook } from '../profile/avatar';
import { unlockContext, isOpen } from '../profile/cosmetics';
import { totalXp, levelFor } from '../profile/profile';
import { UserAvatar, useAvatar } from './UserAvatar';

const HEAD: AvatarCategory[] = ['hair', 'hairColor', 'beard', 'hat', 'eyes'];

/** Your character (the Character tab of the Player Profile): every category, with what is locked and how to open it. */
export function AvatarEditor() {
  const { look, team } = useAvatar();
  const [cat, setCat] = useState<AvatarCategory>('outfit');
  const ctx = useMemo(() => unlockContext(levelFor(totalXp()).level), []);
  const open = (i: AvatarItem) => isOpen(i.rule, ctx);
  const set = (next: AvatarLook) => saveAvatar(next);
  const category = AVATAR_CATEGORIES.find(c => c.id === cat)!;
  const openCount = (items: AvatarItem[]) => items.filter(open).length;
  const allOpen = AVATAR_CATEGORIES.reduce((n, c) => n + openCount(c.items), 0), all = AVATAR_CATEGORIES.reduce((n, c) => n + c.items.length, 0);

  return <section className="locker-bay avatar-editor" aria-label="Your character">
    <div className="ae-stage">
      <UserAvatar look={look} team={team} size={176} title="Your character" />
      <div className="ae-stage-actions">
        <button className="primary" onClick={() => set(randomAvatar(Math.random, (_c, i) => open(i)))}>Randomize</button>
        <small>{allOpen} of {all} pieces unlocked. More open with levels and on the Trophy Road.</small>
      </div>
    </div>
    <div className="ae-pick">
      <div className="stats-view-toggle ae-cats" role="tablist" aria-label="Character categories">
        {AVATAR_CATEGORIES.map(c => <button key={c.id} role="tab" aria-selected={cat === c.id} className={cat === c.id ? 'active' : ''} onClick={() => setCat(c.id)}>
          {c.label} <small>{openCount(c.items)}/{c.items.length}</small></button>)}
      </div>
      <div className="ae-grid" role="radiogroup" aria-label={category.label}>
        {category.items.map(i => {
          const unlocked = open(i), on = look[cat] === i.id;
          return <button key={i.id} role="radio" aria-checked={on} disabled={!unlocked} className={`ae-tile ${on ? 'selected' : ''} ${unlocked ? '' : 'locked'}`}
            onClick={() => set({ ...look, [cat]: i.id })} title={unlocked ? i.name : `${i.name}: ${avatarHow(i)}`}>
            <UserAvatar look={{ ...look, [cat]: i.id }} team={team} size={HEAD.includes(cat) ? 52 : 46} mode={HEAD.includes(cat) ? 'portrait' : 'full'} animate={false} title={i.name} />
            <b>{i.name}</b>{!unlocked && <small>{avatarHow(i)}</small>}
          </button>;
        })}
      </div>
    </div>
  </section>;
}
