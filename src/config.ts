export const LOCATIONS = [
  { id: "chc", name: "Christchurch", lat: -43.5321, lon: 172.6362 },
  { id: "wlg", name: "Wellington", lat: -41.2865, lon: 174.7762 },
] as const;

export type LocationId = (typeof LOCATIONS)[number]["id"];

export const TIMEZONE = "Pacific/Auckland";
export const FORECAST_DAYS = 3;

export const ATTRIBUTION = "Open-Meteo (CC BY 4.0)";
