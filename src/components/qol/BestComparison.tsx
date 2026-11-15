export function BestComparison({current, best, label = 'score'}: {current: number; best?: number; label?: string}) {
 const record = Math.max(current, best ?? current), gap = record - current;
 return <aside className="qol-panel" aria-label="Personal best comparison"><b>This run vs personal best</b><p>This run: {current.toLocaleString()} {label} · Best including this run: {record.toLocaleString()} {label}</p><small>{gap ? `${gap.toLocaleString()} ${label} below your best.` : 'Matches your current personal best.'}</small></aside>;
}
