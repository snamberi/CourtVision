// Types for scripts/theme-palette.mjs (used by src/tests/themes.test.tsx).
export function roleOf(prop: string): 'bg' | 'fg' | 'border' | 'shadow' | 'any';
export function keyOf(literal: string): string;
export function transform(css: string): { out: string; keys: Set<string> };
export function cssFiles(dir?: string): string[];
export function readCss(file: string): string;
