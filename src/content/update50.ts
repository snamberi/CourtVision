import type { Release } from './whatsNew';

// Living Update 50 notes: append every subsequent user-requested feature/fix here.
// Stable sequence key follows legacy date-shaped IDs; it is not a publication date.
export const UPDATE_50: Release = {
  id: '2027-07-07',
  title: 'Update 50: a bigger Court Vision',
  theme: 'relic',
  items: [
    '**Update 50 preview:** these notes describe the Update 50 branch. The release is still being playtested and will keep growing as new changes are added.',
    '**Original character art restored:** players, user characters, portraits, cards and sideline figures use the design from before the character redesign passes again, with its matching court sprite renderer and animation rig. Saved appearances and cosmetics remain intact.',
    '**Relics and luck:** ten new Mythic relics, new Secret relics, rarer Mythic drops, revised luck bonuses, rarity-based coin bonuses and two Mythic upgrade levels. Ultra Cheat now grants a 130-rated ability.',
    '**Court visual polish:** eight directional player views preserve each avatar’s identity; planted-foot runs, braking and landing poses, bounded hand-to-ball reaches and individual release/celebration forms improve the action. Foot shadows stay on the floor, players and the ball layer by depth, and nameplates use separate lanes. Warmer wood, quieter stands, clearer screens, restrained bounce/net/scoring effects and optional short ball trails keep the court readable. A compact scoreboard and shot clock sit above the court, with playback controls below; reduced-motion settings hide decorative effects.',
    '**Watch-game movement:** time-aware paths prevent overshooting turns and stops, running strides cover more ground, and defensive footwork follows actual movement. Passes and shots use fixed release points, with short blends at ball handoffs. Full court is the default with visible Full court and Follow ball controls; full-court view avoids automatic highlight zoom.',
    '**Shop and player animation:** a dedicated Gems balance appears in the shop. Mythic player reveals add expanding halos and a finishing gleam, respecting reduced motion. Court players retain their pixel-art display with interpolated poses sampled at 16 frames per playback second, quicker jumps, smoother landings and hand-aligned dunks.',
    '**Premium spins:** Lucky Spins and Ultra Lucky Spins can be opened ten at a time. Ten free Lucky Spins can also be used together. Batch prices are checked before rolling; each roll keeps its normal odds, pity and duplicate rewards.',
    '**Career player rolls:** Legendary and Mythic Career players have stronger signature skills. Lucky Career rolls show only those two rarities, with a 70% Legendary and 30% Mythic split. Mythic reveals have a clear label, magenta colors and special particles.',
    '**Events and the phone:** a decorated event shortcut sits above the phone apps. Earn +1 event currency per ten minutes of focused play and +20 per hour, with a 50% bonus in Franchise, Your Career and Story. Fractional bonuses carry forward.',
    '**Achievements and rewards:** expanded achievements and progression, including ITS OVER 9000!!! for 9,000 XP and an achievement for Stephen Curry scoring 77 points. Reward previews show what is coming next.',
    '**CourtChat and friends:** CourtChat opens inside the phone with an online count and a Back button. Friend filters, activity, gifts and owner gift tools make it easier to keep up with other players. Notification support remains subject to server setup.',
    '**Player development:** simulated annual improvement and decline usually land near three overall points, with rare changes up to ten, underuse setbacks and bench breakouts. Rating changes apply once after preseason; historical reference development and rating locks are preserved.',
    '**Heated rivalries:** one or two eligible rivalry games per season can become scoring showcases. Leading scorers get more touches without guaranteed baskets or extra minutes.',
    '**Player profiles and trades:** clear role tags such as 3&D, rebounder and perimeter defender. Trade and free-agent lists show full-season averages, falling back to the last played season when needed.',
    '**Deeper Career statistics:** season and lifetime totals plus advanced rates, including true shooting, effective field-goal percentage and per-36 statistics. Faster generation reuses workers without removing games or history.',
    '**Career controls:** choose fast, balanced or relaxed autopilot reading pauses. Give up simulation keeps the last save; Abandon run confirms deletion without retirement rewards. Stopping autopilot now stays stopped after the season finishes.',
    '**An easier 82–0 start:** a beginner Quick Spin start uses Rookie difficulty and visible ratings. Extra rules and daily, weekly, custom and other modes stay available in expandable sections.',
    '**Light and dark looks:** all 27 app looks have light and dark versions with matching previews. Haunted, Winterland, Frozen, Inferno and Glitch have complete scenery. Your brightness choice follows you between looks.',
    '**Music and sound:** two original synthesized background beats, menu clicks, navigation and result sounds, plus optional browser announcer voices. Separate volume controls and hidden-tab pause keep the mix manageable.',
    '**Navigation and settings:** fixed right-side quick jumps, page bookmarks, phone app pins, smoother phone paging, a cleaner footer and settings grouped into appearance, gameplay, saves and support.',
    '**Collections and quality of life:** relic search and mode filters, saved loadouts and luck comparisons, compact inventory, event calendar, glossary, personal-best comparisons, leaderboard explanations and cancellable cosmetic purchases.',
    '**Saving and diagnostics:** cloud-save status, manual Career cloud copies with conflict protection, pending-save warnings, retry controls and a sanitized diagnostics download. The branch includes the earlier account-saving and Google sign-in fixes.',
    '**Layout fixes:** spin descriptions now sit above their purchase buttons. Career results fit the page while wide tables scroll inside it. Trade-deadline and rest-of-season Play buttons have room for their labels. Decorative stripes no longer cover player portraits.',
    '**Update notes follow your look:** note backgrounds and text match your app look and brightness, while each update keeps its original accent on borders and icons. This entry will include future Update 50 additions too.',
  ],
};
