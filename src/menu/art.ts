const images = import.meta.glob<string>('../assets/menu/*.webp', { eager: true, import: 'default' });
export const menuArt = (name: string) => images[`../assets/menu/${name}.webp`];
