import { LOCATIONS } from "./config";
import { fetchWeather } from "./openmeteo";
import { insertObservations, toObservation } from "./store";
import type { Env } from "./types";

export async function runPull(env: Env): Promise<{ fetchedAt: string; locations: number }> {
  const fetchedAt = new Date().toISOString();
  const results = await fetchWeather(LOCATIONS);
  const rows = results.map((r) => toObservation(r, fetchedAt));
  await insertObservations(env.DB, rows);
  return { fetchedAt, locations: rows.length };
}
