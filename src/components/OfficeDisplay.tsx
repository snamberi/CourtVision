import { menuArt } from '../menu/art';
import { readMenuDesign } from '../menu/design';
import './officeDisplay.css';

export function OfficeArt({ name }: { name: string }) {
  return <img className="office-art" src={menuArt(name, readMenuDesign())} alt="" />;
}

export function OfficeFigures({ items }: { items: [string, number][] }) {
  return <dl className="office-figures">{items.map(([label, amount]) =>
    <div key={label}><dt>{label}</dt><dd>{amount < 0 ? '−' : ''}${(Math.abs(amount) / 1e6).toFixed(2)}M</dd></div>
  )}</dl>;
}
