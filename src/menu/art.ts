import type { MenuDesign } from './design';

const images = import.meta.glob<string>('../assets/menu/*/*.webp', { eager: true, import: 'default' });

export function menuArt(name: string, design: MenuDesign = 'fieldhouse'): string {
  return images[`../assets/menu/${design}/${name}.webp`];
}
