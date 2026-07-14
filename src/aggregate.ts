import type { AggregateStats } from "./types";

export async function aggregateForLocation(
  db: D1Database,
  locationId: string,
  days: number,
): Promise<AggregateStats> {
  const row = await db
    .prepare(
      `SELECT
         COUNT(*)              AS samples,
         MIN(temp_c)           AS temp_min,
         MAX(temp_c)           AS temp_max,
         AVG(temp_c)           AS temp_avg,
         SUM(precipitation_mm) AS precip_total,
         MAX(wind_gust_kmh)    AS gust_max
       FROM observations
       WHERE location_id = ?1
         AND fetched_at >= datetime('now', ?2)`,
    )
    .bind(locationId, `-${days} days`)
    .first<Omit<AggregateStats, "location_id">>();

  return {
    location_id: locationId,
    samples: row?.samples ?? 0,
    temp_min: row?.temp_min ?? null,
    temp_max: row?.temp_max ?? null,
    temp_avg: row?.temp_avg ?? null,
    precip_total: row?.precip_total ?? null,
    gust_max: row?.gust_max ?? null,
  };
}
