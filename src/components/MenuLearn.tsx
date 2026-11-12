import guides from '../content/guideIndex.json';

/**
 * "Learn Court Vision" on the main menu: what the game is, and every guide with a one-line summary. The home screen is
 * the page people (and search engines) land on, so it explains the game in words, not only buttons. Web only: the
 * offline Windows edition has no web pages to link to (MainMenu hides this there).
 */
export function MenuLearn() {
  return (
    <section className="menu-learn" aria-labelledby="menu-learn-title">
      <h2 id="menu-learn-title">Learn Court Vision</h2>
      <p>
        Court Vision is a free basketball management and simulation game that runs in your browser. Build a roster,
        set a rotation, replay a historical matchup or follow one player's career, then watch the result play out
        possession by possession. In a league game, every point, rebound and assist in the box score comes from a simulated play, and
        real NBA seasons back to 1946-47 are included.
      </p>
      <p>New here? The guides explain each mode and the systems behind the game.</p>
      <ul>
        {guides.map(g => (
          <li key={g.path}><a href={`/${g.path}`}>{g.nav}</a><span>{g.description}</span></li>
        ))}
      </ul>
      <p className="menu-learn-more"><a href="/guides/">All guides</a> · <a href="/faq.html">FAQ</a> · <a href="/about.html">About Court Vision</a></p>
    </section>
  );
}
