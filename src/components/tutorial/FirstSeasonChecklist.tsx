import type { Lesson, LessonStatus } from '../../tutorial/lessons';

interface Props {
  statuses: LessonStatus[];
  onGo: (lesson: Lesson) => void;
  onHide: () => void;
}

/** Eight first-season lessons that tick themselves off as the player does them. */
export function FirstSeasonChecklist({ statuses, onGo, onHide }: Props) {
  const done = statuses.filter((s) => s.done).length;
  const total = statuses.length;
  const nextIndex = statuses.findIndex((s) => !s.done);
  return (
    <aside className="first-season-checklist" aria-labelledby="checklist-title" data-tour="checklist">
      <div className="checklist-head">
        <h2 id="checklist-title">First season</h2>
        <span className="checklist-count">{done} / {total}</span>
      </div>
      <div className="checklist-progress" role="progressbar" aria-label="Lessons done" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div style={{ width: `${(done / Math.max(1, total)) * 100}%` }} />
      </div>
      <ol className="checklist-items">
        {statuses.map((s, i) => {
          const isNext = i === nextIndex;
          const note = s.lockedUntil ?? (isNext ? s.lesson.detail : null);
          return (
            <li key={s.lesson.id} className={`checklist-item ${s.done ? 'is-done' : ''} ${isNext ? 'is-next' : ''} ${s.lockedUntil ? 'is-locked' : ''}`}>
              <span className="checklist-box" aria-hidden="true">{s.done ? '✓' : ''}</span>
              <span className="checklist-text">
                <span className="checklist-title">{s.lesson.title}</span>
                {!s.done && note && <span className="checklist-detail">{note}</span>}
                <span className="sr-only">{s.done ? ' (done)' : s.lockedUntil ? '' : ' (to do)'}</span>
              </span>
              {!s.done && !s.lockedUntil && <button type="button" className="checklist-go" onClick={() => onGo(s.lesson)} aria-label={`Go: ${s.lesson.title}`}>Go</button>}
            </li>
          );
        })}
      </ol>
      {done === total
        ? <p className="checklist-complete">All {total} done. You know your way around.</p>
        : <p className="hint-text">Go opens the right page and points at what to press. Do them in any order.</p>}
      <button type="button" className="checklist-hide" onClick={onHide}>Hide checklist</button>
    </aside>
  );
}
