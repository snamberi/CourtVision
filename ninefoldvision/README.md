# NineFoldVision studio site

The home of every NineFoldVision game: the games, their updates, and the Vision universe story
(*The Seal of Earth Zero*). A plain static site with no build step and no dependencies. It lives beside
Court Vision in this repo and doesn't affect the game's build.

## Pages

| Page | What it shows |
| --- | --- |
| `index.html` | Studio home: games, latest news and patch notes, the story |
| `games.html` / `game.html?g=<slug>` | The games catalog and one page per game, with its full update history |
| `updates.html` | Studio news and every game's patch notes, filterable by game and searchable |
| `universe.html` | The Vision universe guide: nine Earths, people, laws, the five Gods, places, open threads |
| `story.html` | The chapter reader (`story.html#ch-12` opens chapter 12) |
| `about.html` | The studio, brand assets, contact |

**Spoilers.** On the Universe page, anything marked `class="spoiler" data-ch="N"` stays blurred until the
visitor has reached chapter N in the reader (progress is saved in their browser). They can also tap an item
or switch "Show all spoilers" on.

## Adding things

- **A new game:** add an entry to `site/data/games.js`. It appears on Home, Games and Updates and gets its own
  page. While it's unannounced, the "In the forge" card holds its place.
- **A Court Vision update:** add the release to `src/content/whatsNew.ts` as usual, then run
  `node ninefoldvision/scripts/sync-courtvision.mjs`.
- **Updates for another game:** list them under `updates` in its `games.js` entry (`{ title, items: [{ head, text }] }`,
  newest first), or generate a `data/updates-<slug>.js` file the way Court Vision does.
- **Studio news:** add a post to the top of `site/data/news.js`.
- **Story:** edit `content/books/the-seal-of-earth-zero.md` (`## Chapter N: Title` headings), or add a new book
  next to it with `book: 2` in its front matter, then run `node ninefoldvision/scripts/build-story.mjs`.
- **Contact email and social links:** `site/data/studio.js`. They're hidden until filled in.

## Preview and deploy

```bash
cd ninefoldvision/site && python3 -m http.server 8000   # http://localhost:8000
```

Deploy with Cloudflare Workers (see `wrangler.jsonc`), or any static host pointed at `ninefoldvision/site`.
