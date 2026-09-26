import type { NavMode } from '../../tutorial/tutorialState';
import { SIMPLE_HUBS } from '../../tutorial/simpleNav';

interface Props {
  navMode: NavMode;
  onNavModeChange: (mode: NavMode) => void;
  onReplayTour: () => void;
  /** Present when the league has a team to run, so the checklist applies. */
  checklistHidden?: boolean;
  onToggleChecklist?: () => void;
  lockedCount: number;
  onUnlockAll: () => void;
}

/** Settings › Menu & lessons: menu size, the tour, the checklist and early unlocks. */
export function LessonsSettingsCard({ navMode, onNavModeChange, onReplayTour, checklistHidden, onToggleChecklist, lockedCount, onUnlockAll }: Props) {
  return (
    <section className="lessons-settings" aria-labelledby="lessons-settings-title">
      <h4 id="lessons-settings-title">Menu &amp; lessons</h4>
      <fieldset className="lessons-mode">
        <legend>Menu size</legend>
        <label><input type="radio" name="nav-mode" checked={navMode === 'simple'} onChange={() => onNavModeChange('simple')} /> <b>Simple</b> five places to go ({SIMPLE_HUBS.slice(0, 5).map((h) => h.label).join(', ')}), with tools added as your season goes</label>
        <label><input type="radio" name="nav-mode" checked={navMode === 'full'} onChange={() => onNavModeChange('full')} /> <b>Full</b> every page at once</label>
      </fieldset>
      <p className="hint-text">Nothing is removed in Simple mode: every page sits under one of the five places.</p>
      <div className="code-mode-actions">
        <button type="button" onClick={onReplayTour}>Replay the coach&apos;s tour</button>
        {onToggleChecklist && <button type="button" onClick={onToggleChecklist}>{checklistHidden ? 'Show first-season checklist' : 'Hide first-season checklist'}</button>}
        {navMode === 'simple' && lockedCount > 0 && <button type="button" onClick={onUnlockAll}>Unlock every tool now ({lockedCount} left)</button>}
      </div>
    </section>
  );
}
