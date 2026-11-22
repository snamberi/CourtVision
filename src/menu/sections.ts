export const MENU_SECTIONS = [
  { id: 'play', title: 'Play', icon: 'menuTipoff', hash: '#/menu' },
  { id: 'minigames', title: 'Minigames', icon: 'menuArcade', hash: '#/menu/minigames' },
  { id: 'weekly', title: 'Weekly', icon: 'menuWeek', hash: '#/menu/weekly' },
  { id: 'others', title: 'Others', icon: 'menuLocker', hash: '#/menu/others' },
] as const;

export type MenuSection = typeof MENU_SECTIONS[number]['id'];
export const menuSectionOf = (hash: string) => MENU_SECTIONS.find(section => section.hash === hash)?.id;
export const menuHash = (id: MenuSection) => MENU_SECTIONS.find(section => section.id === id)!.hash;
