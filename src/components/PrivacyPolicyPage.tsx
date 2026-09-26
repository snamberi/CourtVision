import { Fragment, useEffect, type ReactNode } from 'react';
import policy from '../legal/privacyPolicy.json';

/** Path of the static, crawlable copy of this same policy (generated from the same JSON at build time). */
export const PRIVACY_STATIC_PATH = 'privacy.html';
/** Hash route that opens the in-app policy page from anywhere: `<a href="#/privacy">`. */
export const PRIVACY_HASH = '#/privacy';

type Block =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | { type: 'contact' };

/** Tiny inline markup used by the policy text: **bold** and [label](https://url). */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1] !== undefined) nodes.push(<strong key={key++}>{match[1]}</strong>);
    else nodes.push(<a key={key++} href={match[3]} target="_blank" rel="noopener noreferrer">{match[2]}</a>);
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderBlock(block: Block, i: number) {
  switch (block.type) {
    case 'p':
      return <p key={i}>{renderInline(block.text)}</p>;
    case 'ul':
      return <ul key={i}>{block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}</ul>;
    case 'table':
      return (
        <div key={i} className="privacy-table-wrap">
          <table className="privacy-table">
            <thead><tr>{block.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>{row.map((cell, c) => <td key={c}>{c === 1 ? <code>{cell}</code> : cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'contact':
      return (
        <p key={i}>
          {policy.contactEmail
            ? <>Email: <a href={`mailto:${policy.contactEmail}`}>{policy.contactEmail}</a></>
            : <>Please use the contact details published on the website or download page where you obtained CourtVision.</>}
        </p>
      );
  }
}

interface Props {
  /** Leaves the policy and returns to whatever screen was open before. */
  onClose: () => void;
}

export function PrivacyPolicyPage({ onClose }: Props) {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="privacy-page">
      <div className="privacy-inner">
        <button className="privacy-back" onClick={onClose}>← Back to CourtVision</button>
        <h1>{policy.title}</h1>
        <p className="privacy-meta">{policy.product} · Last updated: {policy.lastUpdated}</p>

        {policy.intro.map((text, i) => <p key={i}>{renderInline(text)}</p>)}

        <nav className="privacy-toc" aria-label="Privacy policy contents">
          <strong>Contents</strong>
          <ol>
            {policy.sections.map((s) => (
              <li key={s.id}>
                <a href={`#/privacy/${s.id}`} onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`privacy-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}>{s.heading.replace(/^\d+\.\s*/, '')}</a>
              </li>
            ))}
          </ol>
        </nav>

        {policy.sections.map((section) => (
          <section key={section.id} id={`privacy-${section.id}`}>
            <h2>{section.heading}</h2>
            {(section.blocks as Block[]).map((b, i) => <Fragment key={i}>{renderBlock(b, i)}</Fragment>)}
          </section>
        ))}

        <button className="privacy-back" onClick={onClose}>← Back to CourtVision</button>
      </div>
    </div>
  );
}

/** Small "Privacy Policy" link for menus and footers. Uses the hash route, so it works from any screen and in the offline Windows edition. */
export function PrivacyLink({ className }: { className?: string }) {
  return <a className={className ?? 'legal-link'} href={PRIVACY_HASH}>Privacy Policy</a>;
}
