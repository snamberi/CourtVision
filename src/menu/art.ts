import type { MenuDesign } from './design';

const images = import.meta.glob<string>(['../assets/menu/*.webp', '../assets/menu/*/*.webp'], { eager: true, import: 'default' });

export function menuArt(name: string, design?: MenuDesign): string {
  const directory = design ? `../assets/menu/${design}` : '../assets/menu';
  return images[`${directory}/${name}.webp`];
}
