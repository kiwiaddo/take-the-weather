# CLAUDE.md

Cloudflare Worker + D1 weather aggregator for NZ. Cron pulls Open-Meteo current
conditions every 6h into an `observations` table; a JSON API and a no-build-step
vanilla-JS frontend serve them. See README.md for the user-facing overview.

## Commands

```bash
npm run dev                # wrangler dev on http://localhost:8787
npm run typecheck          # tsc --noEmit — run this before committing TS changes
npm run db:migrate:local   # apply schema.sql to the local (miniflare) D1
npm run db:migrate:remote  # apply schema.sql to production D1
npm run deploy             # manual deploy (normally auto-deploys on push via Cloudflare Git integration)
```

There are no tests and no linter. Frontend files in `public/` are served as-is —
no bundler, no transpile, so keep `public/app.js` browser-compatible plain JS.

## Code map

| File | Responsibility |
|---|---|
| `src/index.ts` | Worker entry: `fetch` → router, `scheduled` → pull |
| `src/router.ts` | All `/api/*` routes; falls through to `env.ASSETS` for static files |
| `src/config.ts` | `LOCATIONS`, timezone, attribution — the single source of truth for locations |
| `src/openmeteo.ts` | Builds the (single, multi-coordinate) Open-Meteo request and parses it |
| `src/pull.ts` | One pull cycle: fetch → map to rows → batch insert |
| `src/store.ts` | All SQL for `observations` (insert, latest-per-location, history) |
| `src/aggregate.ts` | Min/max/avg rollups for `/api/aggregate` |
| `src/types.ts` | Env bindings + row/API shapes |
| `schema.sql` | The one table: `observations` (+ index). No migration framework — it's `CREATE TABLE IF NOT EXISTS`, so additive changes need `ALTER TABLE` statements run by hand |
| `public/app.js` | Frontend: state, sidebar/primary-card rendering, and the hand-rolled SVG meteogram (geometry constants `VB_W`/`TEMP_H`/etc. at the top of the meteogram section) |
| `public/styles.css` | Theme via CSS custom properties; dark mode by `prefers-color-scheme` overriding `:root` vars |

## Conventions & gotchas

- **Locations**: to add one, edit `LOCATIONS` in `src/config.ts` only. Everything
  else (pull, route validation via `isKnownLocation`, frontend sidebar) derives
  from it. Location ids are short lowercase codes (`chc`, `wlg`).
- **Timestamps**: `fetched_at` is UTC ISO with `Z`; `observed_at` is Open-Meteo's
  NZ-local naive string — don't compare them. SQL time filters compare
  `fetched_at` against `datetime('now', '-N hours')`; the formats differ
  (`T`/`Z` vs space) but lexicographic comparison works across dates, which is
  what the existing queries rely on. The frontend uses `fetched_at` exclusively,
  formatted with `Intl.DateTimeFormat` in `Pacific/Auckland`.
- **Open-Meteo response shape**: one coordinate → bare object, multiple → array.
  `normalizeResponseShape` in `src/openmeteo.ts` handles this; keep it if you
  touch the fetch path.
- **Forecasts (planned feature)**: `/api/series` returns `{ history, forecast }`
  with `forecast` currently always `[]`. The frontend (`buildPoints` /
  `renderMeteogram` in `public/app.js`) already merges both and renders forecast
  points as dashed lines and lighter bars — implementing forecasts is a
  backend-only change: pull hourly forecast data (the `daily` block is already
  stored in `raw_json`; hourly would need new Open-Meteo params) and populate
  the array with rows shaped like observations.
- **Meteogram**: pure string-built SVG sized by `viewBox` (responsive by
  scaling). Two panels — temp + precip bars (bars capped at ⅓ panel height,
  their scale is implicit; values live in the tooltip/table) and wind, with
  direction arrows below pointing *with* the flow (`wind_dir_deg + 180`,
  since meteorological direction is where wind comes FROM). Smoothing is
  Catmull-Rom; lines are clipped to their panels via `<clipPath>`.
- **Chart colors** were validated for colorblind safety and contrast in both
  modes (temp `--series-temp` red, precip `--series-precip` blue, wind
  `--series-wind` green, defined in `styles.css`). If you change or add series
  hues, re-validate light and dark variants against the card surfaces
  (`#ffffff` / `#171d26`) rather than eyeballing.
- **Accessibility invariants to preserve**: the legend, the "View data as
  table" twin of the chart, and keyboard crosshair navigation (arrow keys on
  the focused chart wrapper). Tooltip/table/sidebar DOM is built with
  `createElement`/`textContent` — keep it that way for anything data-derived.
- **UI state** persists in `localStorage` under `ttw.loc` and `ttw.hours`.

## Local data for frontend work

The local D1 starts empty and the chart needs ≥2 points. Either trigger real
pulls (`curl -X POST localhost:8787/api/admin/run-pull` — one row per location
per call) or seed synthetic rows spaced ~6h apart with
`wrangler d1 execute nz-weather-db --local --file=<seed.sql>` (`raw_json` can be
`'{}'`). Local state lives in `.wrangler/` (gitignored).
