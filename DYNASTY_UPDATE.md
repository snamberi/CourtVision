# Court Vision — backups, identity and league stories

## Backups and recovery
- Global Settings / Import & Export now includes Backups & recovery. The main menu has the same controls under Recover a league / manage backups.
- Each save has at most five restore points: its original state, manual checkpoints, and automatic checkpoints during play (roughly ten recorded games or ten minutes between changes), including before season/phase transitions. The previous state is protected in the same database transaction as the new save.
- Restore as New League preserves the current slot. Download Backup includes your controlled team; Recover Backup File imports it into a separate league.
- Local backups do not survive clearing site data. Download a JSON backup for protection outside the browser. Deleting a save deletes that save's local checkpoints only.
- The database upgrades from version 1 to 2 without replacing existing saves. Damaged latest snapshots remain listed so their earlier checkpoints can be recovered. Autosave failures produce a visible message.

## Franchise identity
- Your Team → Edit Team Identity: six pixel crest motifs, abbreviation, primary/trim jersey colors, three jersey designs, and home-court paint/border colors. Roster shows every team's identity; editing another team requires sandbox mode.
- Changes affect shared player portraits and Watch Game jerseys; the home team's colors and crest appear on the court. Standings and news include team crests.
- Team pages display championship banners from recorded franchise history/current Finals results and retired-number banners. No titles are invented for new leagues.
- Old leagues get stable default designs automatically. Branding survives exports, saves, recovery, and season rollover.

## League stories
- News Feed includes ten-made-three performances, Finals context, recorded regular-season scoring/shooting records, close back-and-forth rivalries, productive rookies, returning stars, championships, and award winners.
- Rookies use previous seasons played, not age. A returning star requires an actual earlier spell with the team and an intervening spell elsewhere.
- Corrected five-by-five recognition; triple-, quadruple-, and quintuple-doubles are distinct.
- Filter by category, team, or season; open an active player's profile, a current-season box score, or the playoffs from its story.
- Season rollover retains up to 200 archived headlines; the feed displays up to 150. Record claims concern recorded games in that regular season, not fabricated NBA or all-time records.
- Playoff brackets/results now belong to the saved league, keeping Finals stories, banners, and replays available after refresh. A new season clears its old bracket after the stories are archived.
