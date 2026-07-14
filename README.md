# take-the-weather

NZ weather aggregator — a Cloudflare Worker that pulls current conditions for New
Zealand locations from [Open-Meteo](https://open-meteo.com) on a cron, stores them
in a D1 database, and serves them through a small JSON API and a static frontend
with a meteogram chart (temperature, precipitation, wind speed + direction).

## How it works

```
┌────────────┐  cron (every 6h)  ┌────────────┐        ┌────────────┐
│ Open-Meteo │ ────────────────► │   Worker   │ ─────► │  D1 (SQL)  │
└────────────┘                   │ src/*.ts   │        │observations│
                                 └─────┬──────┘        └────────────┘
                                       │ /api/*  + static assets (public/)
                                       ▼
                                 ┌────────────┐
                                 │  Frontend  │  primary location + meteogram,
                                 │ public/*   │  other locations in a sidebar
                                 └────────────┘
```

- **Pull**: a `scheduled` handler (cron `0 */6 * * *`, UTC) fetches current
  conditions for every location in `src/config.ts` in a single Open-Meteo request
  and inserts one row per location into the `observations` table.
- **Serve**: the `fetch` handler routes `/api/*` requests and falls through to the
  static assets binding for everything else (`public/`).
- **Frontend**: plain HTML/CSS/JS, no build step. One primary location is shown
  with current conditions and an SVG meteogram of its history; the other
  locations sit in a sidebar and can be clicked to switch. Selection and time
  range persist in `localStorage`.

## API

| Route | Description |
|---|---|
| `GET /api/locations` | Configured locations (id, name, lat, lon) |
| `GET /api/current` | Latest observation per location |
| `GET /api/history?loc=<id>&hours=<n>` | Raw observations for a location (default 48h) |
| `GET /api/series?loc=<id>&hours=<n>` | Chart series: `{ history: [...], forecast: [] }` — `forecast` is reserved for predicted data; the frontend already renders it (dashed line / lighter bars) |
| `GET /api/aggregate?loc=<id>&days=<n>` | Min/max/avg temp, total precip, max gust (default 7 days) |
| `POST /api/admin/run-pull` | Trigger a pull immediately (testing without waiting for cron) |

## Development

Prereqs: Node 18+, `npm install`.

```bash
npm run dev                # wrangler dev on http://localhost:8787
npm run typecheck          # tsc --noEmit
npm run db:migrate:local   # create the observations table in the local D1
```

The local D1 database starts empty. To get data in:

```bash
# pull real current conditions once (adds one row per location)
curl -X POST http://localhost:8787/api/admin/run-pull
```

The chart needs at least two observations per location, so for frontend work
it's easiest to seed synthetic history — insert rows spaced ~6h apart via
`wrangler d1 execute nz-weather-db --local --file=<seed.sql>` (any values work;
`raw_json` can be `'{}'`).

## Deployment

The Worker deploys to Cloudflare via the Git integration (pushes to the deploy
branch auto-deploy). Manual deploy: `npm run deploy`. Remote schema changes:
`npm run db:migrate:remote`.

## Adding a location

Add an entry to `LOCATIONS` in `src/config.ts` — the pull, API, and frontend are
all driven by that list. New locations start accumulating history on the next
cron run.

## Data notes

- `fetched_at` is UTC ISO 8601 (when we pulled); `observed_at` is Open-Meteo's
  station time in NZ local time. The frontend positions and labels everything
  from `fetched_at`, formatted into `Pacific/Auckland`.
- `raw_json` stores the full per-location Open-Meteo response, including the
  `daily` forecast block that isn't yet surfaced — useful for backfilling
  forecast features later.
- Attribution: weather data by [Open-Meteo.com](https://open-meteo.com), CC BY 4.0.
