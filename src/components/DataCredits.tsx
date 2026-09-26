/** Credits for the built-in NBA history data (menu, League Settings and the NBA History page). */
export function DataCredits({ compact = false }: { compact?: boolean }) {
  return (
    <p className="hint-text data-credits">
      {compact ? 'Data: ' : 'NBA history data: statistics, awards and drafts from '}
      <a href="https://www.basketball-reference.com/" target="_blank" rel="noopener noreferrer">Basketball-Reference.com</a>
      {', compiled by Sumitro Datta ('}
      <a href="https://github.com/sumitrodatta/bball-reference-datasets" target="_blank" rel="noopener noreferrer">bball-reference-datasets</a>
      {'); champions, Finals MVPs, All-Star Game MVPs and Coaches of the Year from '}
      <a href="https://www.nba.com/news/history-all-time-awards" target="_blank" rel="noopener noreferrer">NBA.com</a>
      {'.'}{!compact && ' Player ratings, skill attributes and team names are Court Vision’s own. Court Vision is not affiliated with or endorsed by the NBA, its teams or these sources.'}
    </p>
  );
}
