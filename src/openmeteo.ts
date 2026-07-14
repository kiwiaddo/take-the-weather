import { LOCATIONS, TIMEZONE, FORECAST_DAYS } from "./config";
import type { OpenMeteoLocationResponse, ParsedLocationWeather } from "./types";

const CURRENT = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "precipitation",
  "weather_code",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
].join(",");

const DAILY = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "uv_index_max",
].join(",");

export function buildUrl(
  locs: ReadonlyArray<{ lat: number; lon: number }> = LOCATIONS,
  tz: string = TIMEZONE,
  days: number = FORECAST_DAYS,
): string {
  const lat = locs.map((l) => l.lat).join(",");
  const lon = locs.map((l) => l.lon).join(",");
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: CURRENT,
    daily: DAILY,
    timezone: tz,
    forecast_days: String(days),
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

/**
 * Open-Meteo returns a bare object (not wrapped in an array) when only one
 * coordinate pair is requested, but an array when multiple are requested.
 * Normalise both shapes to an array here.
 */
function normalizeResponseShape(
  body: unknown,
): OpenMeteoLocationResponse[] {
  if (Array.isArray(body)) {
    return body as OpenMeteoLocationResponse[];
  }
  return [body as OpenMeteoLocationResponse];
}

export async function fetchWeather(
  locs: ReadonlyArray<{ id: string; name: string; lat: number; lon: number }> = LOCATIONS,
): Promise<ParsedLocationWeather[]> {
  const url = buildUrl(locs);
  const res = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  const perLocation = normalizeResponseShape(body);

  if (perLocation.length !== locs.length) {
    throw new Error(
      `Open-Meteo returned ${perLocation.length} results for ${locs.length} locations`,
    );
  }

  return perLocation.map((raw, i) => {
    const loc = locs[i]!;
    return {
      locationId: loc.id as ParsedLocationWeather["locationId"],
      locationName: loc.name,
      lat: loc.lat,
      lon: loc.lon,
      current: raw.current,
      daily: raw.daily,
      raw,
    };
  });
}
