// WMO weather interpretation codes -> label
const WEATHER_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function weatherLabel(code) {
  return WEATHER_CODES[code] ?? "Unknown";
}

function formatObservedAt(isoLike) {
  if (!isoLike) return "";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return isoLike;
  return d.toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildSparkline(points) {
  if (points.length < 2) return "";
  const width = 200;
  const height = 48;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <path d="M${coords.join(" L")}" />
  </svg>`;
}

function renderCard(location, observation, historyRows) {
  if (!observation) {
    return `<div class="card">
      <h2>${location.name}</h2>
      <p class="error">No data yet</p>
    </div>`;
  }

  const temps = historyRows.map((r) => r.temp_c).filter((t) => typeof t === "number");

  return `<div class="card">
    <h2>${location.name}</h2>
    <p class="observed-at">Observed ${formatObservedAt(observation.observed_at)}</p>
    <div class="temp-row">
      <span class="temp">${Math.round(observation.temp_c)}°C</span>
      <span class="condition">${weatherLabel(observation.weather_code)}</span>
    </div>
    <div class="details">
      <span>Feels like <strong>${Math.round(observation.apparent_temp_c)}°C</strong></span>
      <span>Humidity <strong>${observation.humidity_pct}%</strong></span>
      <span>Wind <strong>${Math.round(observation.wind_kmh)} km/h</strong></span>
      <span>Gusts <strong>${Math.round(observation.wind_gust_kmh)} km/h</strong></span>
    </div>
    ${buildSparkline(temps)}
  </div>`;
}

async function loadWeather() {
  const cardsEl = document.getElementById("cards");
  try {
    const [locationsRes, currentRes] = await Promise.all([
      fetch("/api/locations").then((r) => r.json()),
      fetch("/api/current").then((r) => r.json()),
    ]);

    const locations = locationsRes.locations;
    const observationsByLoc = Object.fromEntries(
      currentRes.observations.map((o) => [o.location_id, o]),
    );

    const historyByLoc = Object.fromEntries(
      await Promise.all(
        locations.map(async (loc) => {
          const res = await fetch(`/api/history?loc=${loc.id}&hours=48`).then((r) => r.json());
          return [loc.id, res.observations ?? []];
        }),
      ),
    );

    cardsEl.innerHTML = locations
      .map((loc) => renderCard(loc, observationsByLoc[loc.id], historyByLoc[loc.id] ?? []))
      .join("");
  } catch (err) {
    console.error(err);
    cardsEl.innerHTML = `<p class="error">Couldn't load weather data. Please try again later.</p>`;
  }
}

loadWeather();
