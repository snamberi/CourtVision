import { OfficeArt } from './OfficeDisplay';
import './seasonRooms.css';

export function SeasonHeading({ title, art }: { title: string; art: string }) {
  return <div className="season-heading"><OfficeArt name={art} /><h2>{title}</h2></div>;
}
