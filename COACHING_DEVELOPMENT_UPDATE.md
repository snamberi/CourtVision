# Coaching and player development

This update extends existing leagues automatically. Existing players, head coaches, contracts, history, badges and locked minute plans are preserved. Coach career tracking begins when this system is introduced; earlier employment history is not invented.

## Where to start

Open **Staff Market** to interview, hire, promote or release staff. Open **Development** for roster plans, a seven-day practice calendar, rotations, reports and automation. Player profiles now have a **Development** tab; other teams' plans and staff remain read-only outside Sandbox.

## Staff and basketball systems

- Five positions: head coach, offensive assistant, defensive assistant, development coach and athletic trainer.
- Ten separate coaching attributes, specialties, preferences, personality, career records, relationships and development history.
- Persistent candidates assess salary, contract term, role, team competitiveness, facilities and fit. Interviews explain their priorities. Offers face staff budgets; releasing or replacing a coach pays their remaining contract and creates a short adjustment period.
- Assistants can be promoted. Contracts expire at season rollover; successful development coaches can seek head-coaching work. Some retired players enter coaching with independently generated teaching ability.
- Six offensive systems and five defensive schemes have roster-fit, familiarity and basketball tradeoffs. Motion encourages assisted shots; isolation changes usage; drop concedes perimeter opportunities; slow switching defenders and pressure defense have weaknesses. These affect possessions rather than adding a flat overall-rating bonus.

## Rotations and training

- Fixed, performance, development, matchup and playoff rotation styles; preferred starters, closing, small-ball and defensive groups; backup ball handler and override controls.
- Existing rotation reviews and explanations remain. Exact/manual minute plans remain protected.
- Individual primary/secondary focus, intensity, target role, assigned coach and veteran mentor. Actual game minutes and possessions supply opportunity evidence.
- Calendar-based practices cover skills, offense, defense, conditioning, film and recovery. Auto Practice considers schedule, fatigue and playoffs. Injured players have restricted work. Training workload affects recovery and game fatigue.
- Growth is skill-specific and uncertain, affected by age, work ethic, teaching, high existing ratings, health, opportunity and the league's development settings. Excessive minutes are not the best development strategy; potential is not a guarantee.
- Long-term projects track progress, requirements, stalls and partial success. Cancelling preserves real attribute gains. Progress is measured over months, with timing depending on circumstances.
- Veteran mentors must be at least 27 and four years older than their mentee, with at most two mentees. Mentorship supports relevant training and relationships; it does not copy ratings or badges.

## Player relationships, badges and reports

Normal badges can be earned through sufficient ability, sustained efficient game evidence and relevant practice. Progress has broad stages and can regress. Experimental badges and manual badge editing remain Sandbox-only.

Role conversations affect trust and morale, have cooldowns, and can create measurable ten-game rotation/workload promises. Broken promises carry consequences; repeated conversations cannot instantly farm morale.

Weekly/monthly team reports and player development history record practice, workload, projects and permanent attribute changes. Offseason training and aging create a separate report. Temporary workload and morale effects do not overwrite base ratings.

AI teams use the same hiring, training, project, mentor and rotation systems, revisit plans after roster changes, protect older players from heavy workloads and can replace coaches after sustained underperformance when an affordable improvement is available.

## Controls and compatibility

- **Simple:** automatic staff, plans and practice.
- **Standard:** manual staff/plans, automatic practice.
- **Deep:** manual staff, plans and practice.
- Individual automation switches remain available. League settings include familiarity speed, mentorship impact, morale impact, training fatigue, staff budget restrictions and report frequency; existing development-speed/randomness/coaching-impact rules still apply.
- Browser refresh/deep links, portable saves, Sandbox restrictions and read-only team profiles remain supported.
- The source build also rebuilds the bundled Windows/offline package. No deployment is performed by this update.

## Validation

TypeScript, lint, simulation tests and browser checks cover migration/save round trips, ownership, offers/payouts, promotions, calendar idempotence, workload/recovery, injury restrictions, mentor limits, actual game evidence, project cancellation, badge qualification, promises, offseason rollover and system tradeoffs. Browser checks exercise hiring through save/reload, player plans, projects, practices, locked minutes, reports and mobile layout. Production checks cover league creation, CSV imports, watching games and reopening saves on web and offline builds.

Run the full simulation suite with `npx vitest run --maxWorkers=2 --testTimeout=20000`; multi-season/bracket tests need more than the default five seconds on constrained machines.
