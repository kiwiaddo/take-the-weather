CREATE TABLE IF NOT EXISTS observations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  location_id   TEXT    NOT NULL,
  location_name TEXT    NOT NULL,
  fetched_at    TEXT    NOT NULL,   -- ISO 8601, UTC (when we pulled)
  observed_at   TEXT,               -- Open-Meteo current.time (local)
  model         TEXT,               -- resolved model, if requested
  temp_c            REAL,
  apparent_temp_c   REAL,
  humidity_pct      INTEGER,
  precipitation_mm  REAL,
  weather_code      INTEGER,
  wind_kmh          REAL,
  wind_gust_kmh     REAL,
  wind_dir_deg      INTEGER,
  raw_json      TEXT NOT NULL       -- full per-location JSON blob
);

CREATE INDEX IF NOT EXISTS idx_obs_loc_time
  ON observations (location_id, fetched_at);
