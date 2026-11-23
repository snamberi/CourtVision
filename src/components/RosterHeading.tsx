import { OfficeArt } from './OfficeDisplay';

export function RosterHeading({ title, art }: { title: string; art: string }) {
  return <header className="roster-heading"><OfficeArt name={art} /><h2>{title}</h2></header>;
}
