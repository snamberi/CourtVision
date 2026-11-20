import fieldhouse from '../assets/menu/courts/fieldhouse.png';
import blacktop from '../assets/menu/courts/blacktop.png';
import pocket from '../assets/menu/courts/pocket.png';
import backCut from '../assets/menu/courts/pocket-cut.png';

export const MENU_DESIGNS = [
  { id: 'fieldhouse', name: 'Fieldhouse' },
  { id: 'blacktop', name: 'Blacktop' },
  { id: 'pocket', name: 'Pocket GM' },
] as const;
export type MenuDesign = typeof MENU_DESIGNS[number]['id'];
const preference = 'cv-menu-design';
const isDesign = (value: unknown): value is MenuDesign => MENU_DESIGNS.some(d => d.id === value);

export function readMenuDesign(): MenuDesign {
  try {
    const saved = localStorage.getItem(preference);
    if (isDesign(saved)) return saved;
  } catch { /* The menu also works with storage disabled. */ }
  return 'fieldhouse';
}

export function saveMenuDesign(design: MenuDesign) {
  try { localStorage.setItem(preference, design); } catch { /* Use the selection for this visit. */ }
}

export function courtPlate(design: MenuDesign, mode: string) {
  if (design === 'pocket') return ['career', 'story', 'yourCareer', 'street', 'oneOnOne'].includes(mode) ? backCut : pocket;
  return design === 'blacktop' ? blacktop : fieldhouse;
}
