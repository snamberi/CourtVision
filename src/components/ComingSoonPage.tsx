interface Props {
  tab: string;
}

const DESCRIPTIONS: Record<string, string> = {
  financesLeague: 'League-wide finances now live under Team → Finances (GM → Payroll), showing every team\'s market size, revenue, and financial health side by side.',
};

export function ComingSoonPage({ tab }: Props) {
  const description = DESCRIPTIONS[tab] ?? 'This page is on the roadmap but not built yet.';
  return (
    <div className="coming-soon-page">
      <h4>Coming Soon</h4>
      <p className="hint-text">{description}</p>
    </div>
  );
}
