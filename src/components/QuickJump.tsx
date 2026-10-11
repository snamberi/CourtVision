import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { PixelIcon } from './PixelIcon';
import { NAV_ICONS } from '../navigation/menu';
import { matchJump, SHORTCUTS, type JumpItem } from '../navigation/quickJump';

/** Ctrl+K (or /): type part of a page's name and press Enter to go there. Arrow keys move the highlight. */
export function QuickJump({ items, onPick, onClose }: { items: JumpItem[]; onPick: (item: JumpItem) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [at, setAt] = useState(0);
  const found = useMemo(() => matchJump(items, query).slice(0, 12), [items, query]);
  const pick = (item?: JumpItem) => { if (item) { onPick(item); onClose(); } };
  return <Modal label="Go to a page" onClose={onClose} className="quick-jump">
    <label className="quick-jump-search"><PixelIcon name="search" size={16} />
      <input autoFocus value={query} placeholder="Go to… (roster, trade, standings)" aria-label="Page name" aria-controls="quick-jump-list"
        aria-activedescendant={found[at] ? `qj-${at}` : undefined}
        onChange={e => { setQuery(e.target.value); setAt(0); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setAt(i => Math.min(found.length - 1, i + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setAt(i => Math.max(0, i - 1)); }
          else if (e.key === 'Enter') { e.preventDefault(); pick(found[at]); }
        }} />
    </label>
    <ul id="quick-jump-list" className="quick-jump-list" role="listbox" aria-label="Pages">
      {found.map((item, i) => <li key={`${item.group}-${item.label}`} id={`qj-${i}`} role="option" aria-selected={i === at}>
        <button className={i === at ? 'on' : ''} onMouseEnter={() => setAt(i)} onClick={() => pick(item)}>
          <PixelIcon name={NAV_ICONS[item.tab] ?? 'list'} size={14} /> <b>{item.label}</b> <small>{item.group}</small>
        </button>
      </li>)}
      {!found.length && <li className="hint-text">No page called “{query}”.</li>}
    </ul>
    <p className="hint-text quick-jump-foot">↑ ↓ to move · Enter to open · Esc to close · ? for every shortcut</p>
  </Modal>;
}

/** The "?" list of keyboard shortcuts. */
export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return <Modal label="Keyboard shortcuts" onClose={onClose} className="shortcut-help">
    <h2><PixelIcon name="list" size={16} /> Keyboard shortcuts</h2>
    <table className="db-table"><tbody>{SHORTCUTS.map(([k, what]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{what}</td></tr>)}</tbody></table>
    <p className="hint-text">Letter shortcuts work when you're not typing in a box.</p>
    <button onClick={onClose}>Close</button>
  </Modal>;
}
