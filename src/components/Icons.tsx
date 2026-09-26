export function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.9 6.4 6.9.7-5.2 4.7 1.5 6.8L12 17.6l-6.1 3.5 1.5-6.8-5.2-4.7 6.9-.7z" />
    </svg>
  );
}

/** Arrow pointing down into a tray - the universal "download" glyph. Pure SVG so it stays crisp and needs no emoji/font. */
export function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 10.5l5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  );
}
