import { PixelIcon } from '../PixelIcon';

// Vite owns the URLs, including the relative paths in the offline Windows build.
const files = import.meta.glob<string>('../../assets/relics/relic-*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});
const images = new Map(Object.entries(files).map(([file, url]) => [
  file.slice(file.lastIndexOf('/relic-') + 7, -4), url,
]));
const sealed = images.get('mystery')!;

/** Decorative inventory art; the adjacent name supplies the accessible label.
 * Leave id out for an undiscovered secret so its art is not revealed early.
 */
export function RelicArt({ id, size = 64, locked = false }: { id?: string; size?: number; locked?: boolean }) {
  const src = (id && images.get(id)) || sealed;
  return <span className={`relic-art${locked ? ' relic-art--locked' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
    <img key={src} src={src} width={size} height={size} alt="" draggable={false}
      loading={size >= 96 ? 'eager' : 'lazy'} decoding="async"
      onError={event => {
        const img = event.currentTarget;
        if (img.dataset.fallback) return;
        img.dataset.fallback = 'true';
        img.src = sealed;
      }} />
    {locked && <span className="relic-art-lock"><PixelIcon name="lock" size={12} /></span>}
  </span>;
}
