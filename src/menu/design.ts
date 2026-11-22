export const MENU_DESIGNS = [
  { id: 'fieldhouse', name: 'Fieldhouse' },
  { id: 'blacktop', name: 'Blacktop' },
  { id: 'pocket', name: 'Pocket GM' },
] as const;
export type MenuDesign = typeof MENU_DESIGNS[number]['id'];
const preference = 'cv-menu-design';
const isDesign = (value: unknown): value is MenuDesign => MENU_DESIGNS.some(d => d.id === value);

export function isMenuArtPreview(): boolean {
  return new URLSearchParams(location.search).has('menuArt') || document.documentElement.hasAttribute('data-menu-art-preview');
}

export function readMenuDesign(): MenuDesign {
  const requested = new URLSearchParams(location.search).get('menuArt');
  if (isDesign(requested)) return requested;
  try {
    const saved = localStorage.getItem(preference);
    if (isDesign(saved)) return saved;
  } catch { /* The menu also works with storage disabled. */ }
  return 'fieldhouse';
}

export function saveMenuDesign(design: MenuDesign) {
  try { localStorage.setItem(preference, design); } catch { /* Use the selection for this visit. */ }
  const url = new URL(location.href);
  if (url.searchParams.has('menuArt') && url.protocol !== 'file:') {
    url.searchParams.set('menuArt', design);
    history.replaceState(history.state, '', url);
  }
}
