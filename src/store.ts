import type { NewObservation, ObservationRow, ParsedLocationWeather } from "./types";

export function toObservation(
  loc: ParsedLocationWeather,
  fetchedAt: string,
): NewObservation {
  const c = loc.current;
  return {
    location_id: loc.locationId,
    location_name: loc.locationName,
    fetched_at: fetchedAt,
    observed_at: c?.time ?? null,
    model: null,
    temp_c: c?.temperature_2m ?? null,
    apparent_temp_c: c?.apparent_temperature ?? null,
    humidity_pct: c?.relative_humidity_2m ?? null,
    precipitation_mm: c?.precipitation ?? null,
    weather_code: c?.weather_code ?? null,
    wind_kmh: c?.wind_speed_10m ?? null,
    wind_gust_kmh: c?.wind_gusts_10m ?? null,
    wind_dir_deg: c?.wind_direction_10m ?? null,
    raw_json: JSON.stringify(loc.raw),
  };
}

export async function insertObservation(db: D1Database, row: NewObservation): Promise<void> {
  await db
    .prepare(
      `INSERT INTO observations (
        location_id, location_name, fetched_at, observed_at, model,
        temp_c, apparent_temp_c, humidity_pct, precipitation_mm, weather_code,
        wind_kmh, wind_gust_kmh, wind_dir_deg, raw_json
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
    )
    .bind(
      row.location_id,
      row.location_name,
      row.fetched_at,
      row.observed_at,
      row.model,
      row.temp_c,
      row.apparent_temp_c,
      row.humidity_pct,
      row.precipitation_mm,
      row.weather_code,
      row.wind_kmh,
      row.wind_gust_kmh,
      row.wind_dir_deg,
      row.raw_json,
    )
    .run();
}

export async function insertObservations(db: D1Database, rows: NewObservation[]): Promise<void> {
  const stmt = db.prepare(
    `INSERT INTO observations (
      location_id, location_name, fetched_at, observed_at, model,
      temp_c, apparent_temp_c, humidity_pct, precipitation_mm, weather_code,
      wind_kmh, wind_gust_kmh, wind_dir_deg, raw_json
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
  );
  const batch = rows.map((row) =>
    stmt.bind(
      row.location_id,
      row.location_name,
      row.fetched_at,
      row.observed_at,
      row.model,
      row.temp_c,
      row.apparent_temp_c,
      row.humidity_pct,
      row.precipitation_mm,
      row.weather_code,
      row.wind_kmh,
      row.wind_gust_kmh,
      row.wind_dir_deg,
      row.raw_json,
    ),
  );
  await db.batch(batch);
}

export async function latestPerLocation(db: D1Database): Promise<ObservationRow[]> {
  const { results } = await db
    .prepare(
      `SELECT o.* FROM observations o
       INNER JOIN (
         SELECT location_id, MAX(fetched_at) AS max_fetched_at
         FROM observations
         GROUP BY location_id
       ) latest
       ON o.location_id = latest.location_id AND o.fetched_at = latest.max_fetched_at
       ORDER BY o.location_name ASC`,
    )
    .all<ObservationRow>();
  return results;
}

export async function history(
  db: D1Database,
  locationId: string,
  hours: number,
): Promise<ObservationRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM observations
       WHERE location_id = ?1
         AND fetched_at >= datetime('now', ?2)
       ORDER BY fetched_at ASC`,
    )
    .bind(locationId, `-${hours} hours`)
    .all<ObservationRow>();
  return results;
}
