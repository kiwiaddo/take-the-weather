import type { LocationId } from "./config";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export interface CurrentBlock {
  time: string;
  interval: number;
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
}

export interface DailyBlock {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  uv_index_max: number[];
}

export interface OpenMeteoLocationResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current: CurrentBlock;
  daily: DailyBlock;
}

export interface ParsedLocationWeather {
  locationId: LocationId;
  locationName: string;
  lat: number;
  lon: number;
  current: CurrentBlock;
  daily: DailyBlock;
  raw: OpenMeteoLocationResponse;
}

export interface ObservationRow {
  id: number;
  location_id: string;
  location_name: string;
  fetched_at: string;
  observed_at: string | null;
  model: string | null;
  temp_c: number | null;
  apparent_temp_c: number | null;
  humidity_pct: number | null;
  precipitation_mm: number | null;
  weather_code: number | null;
  wind_kmh: number | null;
  wind_gust_kmh: number | null;
  wind_dir_deg: number | null;
  raw_json: string;
}

export interface NewObservation {
  location_id: string;
  location_name: string;
  fetched_at: string;
  observed_at: string | null;
  model: string | null;
  temp_c: number | null;
  apparent_temp_c: number | null;
  humidity_pct: number | null;
  precipitation_mm: number | null;
  weather_code: number | null;
  wind_kmh: number | null;
  wind_gust_kmh: number | null;
  wind_dir_deg: number | null;
  raw_json: string;
}

export interface AggregateStats {
  location_id: string;
  samples: number;
  temp_min: number | null;
  temp_max: number | null;
  temp_avg: number | null;
  precip_total: number | null;
  gust_max: number | null;
}
