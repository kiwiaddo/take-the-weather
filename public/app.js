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

// code -> [day emoji, night emoji]
const WEATHER_EMOJI = {
  0: ["☀️", "🌙"],
  1: ["🌤️", "🌙"],
  2: ["⛅", "☁️"],
  3: ["☁️", "☁️"],
  45: ["🌫️", "🌫️"],
  48: ["🌫️", "🌫️"],
  51: ["🌦️", "🌧️"],
  53: ["🌧️", "🌧️"],
  55: ["🌧️", "🌧️"],
  56: ["🌧️", "🌧️"],
  57: ["🌧️", "🌧️"],
  61: ["🌦️", "🌧️"],
  63: ["🌧️", "🌧️"],
  65: ["🌧️", "🌧️"],
  66: ["🌧️", "🌧️"],
  67: ["🌧️", "🌧️"],
  71: ["🌨️", "🌨️"],
  73: ["🌨️", "🌨️"],
  75: ["❄️", "❄️"],
  77: ["🌨️", "🌨️"],
  80: ["🌦️", "🌧️"],
  81: ["🌧️", "🌧️"],
  82: ["⛈️", "⛈️"],
  85: ["🌨️", "🌨️"],
  86: ["🌨️", "🌨️"],
  95: ["⛈️", "⛈️"],
  96: ["⛈️", "⛈️"],
  99: ["⛈️", "⛈️"],
};

const NZ_TZ = "Pacific/Auckland";
const RANGES = [
  { hours: 24, label: "24h" },
  { hours: 48, label: "48h" },
  { hours: 168, label: "7d" },
];

const state = {
  locations: [],
  currentByLoc: {},
  selectedId: localStorage.getItem("ttw.loc") || null,
  hours: Number(localStorage.getItem("ttw.hours")) || 48,
};

function weatherLabel(code) {
  return WEATHER_CODES[code] ?? "Unknown";
}

function weatherEmoji(code, hourNz) {
  const pair = WEATHER_EMOJI[code];
  if (!pair) return "🌡️";
  const isDay = hourNz >= 7 && hourNz < 19;
  return isDay ? pair[0] : pair[1];
}

function compass(deg) {
  if (typeof deg !== "number") return "";
  const points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return points[Math.round(deg / 22.5) % 16];
}

function nzParts(isoUtc) {
  const d = new Date(isoUtc.endsWith("Z") ? isoUtc : isoUtc + "Z");
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: NZ_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    epoch: d.getTime(),
    weekday: get("weekday"),
    day: get("day"),
    month: get("month"),
    hour: Number(get("hour")) % 24,
    dateKey: `${get("day")} ${get("month")}`,
  };
}

function formatObservedAt(isoLike) {
  if (!isoLike) return "";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return isoLike;
  return d.toLocaleString("en-NZ", {
    timeZone: NZ_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------------------------------------------------------------------------
// Meteogram
// ---------------------------------------------------------------------------

// Layout constants (SVG viewBox units)
const VB_W = 760;
const M_LEFT = 44;
const M_RIGHT = 14;
const AXIS_TOP = 40;      // day + hour labels band
const TEMP_H = 185;
const PANEL_GAP = 26;
const WIND_H = 84;
const ARROW_BAND = 34;
const TEMP_Y0 = AXIS_TOP + 4;
const TEMP_Y1 = TEMP_Y0 + TEMP_H;
const WIND_Y0 = TEMP_Y1 + PANEL_GAP;
const WIND_Y1 = WIND_Y0 + WIND_H;
const VB_H = WIND_Y1 + ARROW_BAND;
const INNER_W = VB_W - M_LEFT - M_RIGHT;

function niceStep(range, targetTicks) {
  const raw = range / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  for (const m of [1, 2, 5, 10]) {
    if (m * pow >= raw) return m * pow;
  }
  return 10 * pow;
}

// Catmull-Rom -> cubic bezier, for a gently smoothed line like a meteogram.
function smoothPath(pts) {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * Build chart points from the /api/series payload. Each point carries
 * kind: "history" | "forecast" — forecast points render dashed / lighter,
 * so populating `forecast` on the backend later needs no frontend change.
 */
function buildPoints(series) {
  const mk = (row, kind) => {
    const t = nzParts(row.fetched_at);
    return {
      kind,
      epoch: t.epoch,
      nz: t,
      temp: row.temp_c,
      feels: row.apparent_temp_c,
      precip: row.precipitation_mm,
      wind: row.wind_kmh,
      gust: row.wind_gust_kmh,
      dir: row.wind_dir_deg,
      code: row.weather_code,
    };
  };
  return [
    ...(series.history ?? []).map((r) => mk(r, "history")),
    ...(series.forecast ?? []).map((r) => mk(r, "forecast")),
  ].sort((a, b) => a.epoch - b.epoch);
}

function renderMeteogram(points) {
  const t0 = points[0].epoch;
  const t1 = points[points.length - 1].epoch;
  const xOf = (epoch) =>
    t1 === t0 ? M_LEFT + INNER_W / 2 : M_LEFT + ((epoch - t0) / (t1 - t0)) * INNER_W;

  // --- temperature scale
  const temps = points.map((p) => p.temp).filter((v) => typeof v === "number");
  let tMin = Math.floor(Math.min(...temps)) - 1;
  let tMax = Math.ceil(Math.max(...temps)) + 1;
  const tStep = niceStep(tMax - tMin, 4);
  tMin = Math.floor(tMin / tStep) * tStep;
  tMax = Math.ceil(tMax / tStep) * tStep;
  const yTemp = (v) => TEMP_Y1 - ((v - tMin) / (tMax - tMin)) * TEMP_H;

  // --- precipitation scale (bars occupy at most the bottom third of the temp panel)
  const precipMax = Math.max(1, ...points.map((p) => p.precip ?? 0));
  const precipH = (v) => ((v ?? 0) / precipMax) * (TEMP_H / 3);

  // --- wind scale
  const winds = points.map((p) => p.wind).filter((v) => typeof v === "number");
  const wMaxRaw = Math.max(5, ...winds);
  const wStep = niceStep(wMaxRaw, 3);
  const wMax = Math.ceil(wMaxRaw / wStep) * wStep;
  const yWind = (v) => WIND_Y1 - (v / wMax) * WIND_H;

  // label/icon stride so dense ranges (7d) stay readable
  const stride = Math.max(1, Math.ceil(points.length / 14));

  const g = { grid: [], axis: [], marks: [], labels: [] };

  // --- vertical hour gridlines + hour labels + icons + wind arrows
  points.forEach((p, i) => {
    if (i % stride !== 0) return;
    const x = xOf(p.epoch);
    g.grid.push(`<line x1="${x}" y1="${TEMP_Y0}" x2="${x}" y2="${TEMP_Y1}" class="grid-v"/>`);
    g.grid.push(`<line x1="${x}" y1="${WIND_Y0}" x2="${x}" y2="${WIND_Y1}" class="grid-v"/>`);
    g.axis.push(`<text x="${x}" y="${AXIS_TOP - 6}" class="tick-label" text-anchor="middle">${String(p.nz.hour).padStart(2, "0")}</text>`);
    if (typeof p.code === "number") {
      g.marks.push(`<text x="${x}" y="${TEMP_Y0 + 18}" class="wx-icon" text-anchor="middle">${weatherEmoji(p.code, p.nz.hour)}</text>`);
    }
    if (typeof p.dir === "number") {
      // meteorological direction is where wind comes FROM; arrow points with the flow
      const rot = (p.dir + 180) % 360;
      g.marks.push(`<g transform="translate(${x},${WIND_Y1 + 20}) rotate(${rot})"><path d="M0,-7 L4.5,5 L0,2 L-4.5,5 Z" class="wind-arrow"/></g>`);
    }
  });

  // --- day boundaries + day labels
  const daySpans = [];
  let spanStart = 0;
  for (let i = 1; i <= points.length; i++) {
    if (i === points.length || points[i].nz.dateKey !== points[spanStart].nz.dateKey) {
      daySpans.push({ from: spanStart, to: i - 1 });
      spanStart = i;
    }
  }
  daySpans.forEach((span, si) => {
    const p = points[span.from];
    if (si > 0) {
      // midnight boundary: binary-search the exact date flip between points
      let lo = points[span.from - 1].epoch;
      let hi = p.epoch;
      const targetKey = p.nz.dateKey;
      while (hi - lo > 60_000) {
        const mid = (lo + hi) / 2;
        if (nzParts(new Date(mid).toISOString()).dateKey === targetKey) hi = mid;
        else lo = mid;
      }
      const bx = xOf(hi);
      g.grid.push(`<line x1="${bx}" y1="${AXIS_TOP - 34}" x2="${bx}" y2="${WIND_Y1}" class="grid-day"/>`);
    }
    const xa = xOf(points[span.from].epoch);
    const xb = xOf(points[span.to].epoch);
    g.axis.push(`<text x="${(xa + xb) / 2}" y="${AXIS_TOP - 24}" class="day-label" text-anchor="middle">${p.nz.weekday} ${p.nz.day} ${p.nz.month}</text>`);
  });

  // --- temperature gridlines + y labels
  for (let v = tMin; v <= tMax; v += tStep) {
    const y = yTemp(v);
    g.grid.push(`<line x1="${M_LEFT}" y1="${y}" x2="${VB_W - M_RIGHT}" y2="${y}" class="grid-h"/>`);
    g.axis.push(`<text x="${M_LEFT - 6}" y="${y + 3}" class="tick-label" text-anchor="end">${v}°</text>`);
  }

  // --- wind gridlines + y labels
  for (let v = 0; v <= wMax; v += wStep) {
    const y = yWind(v);
    g.grid.push(`<line x1="${M_LEFT}" y1="${y}" x2="${VB_W - M_RIGHT}" y2="${y}" class="grid-h"/>`);
    g.axis.push(`<text x="${M_LEFT - 6}" y="${y + 3}" class="tick-label" text-anchor="end">${v}</text>`);
  }

  // --- precipitation bars (rounded data-end, square baseline, 2px gaps)
  const step = points.length > 1 ? INNER_W / (points.length - 1) : INNER_W;
  const barW = Math.max(3, Math.min(step - 2, 20));
  let maxPrecipIdx = -1;
  points.forEach((p, i) => {
    if ((p.precip ?? 0) > 0 && (maxPrecipIdx < 0 || p.precip > points[maxPrecipIdx].precip)) {
      maxPrecipIdx = i;
    }
  });
  points.forEach((p, i) => {
    const h = precipH(p.precip);
    if (h <= 0) return;
    const x = xOf(p.epoch) - barW / 2;
    const yTop = TEMP_Y1 - h;
    const r = Math.min(4, h, barW / 2);
    const cls = p.kind === "forecast" ? "precip-bar forecast" : "precip-bar";
    g.marks.push(
      `<path class="${cls}" d="M${x},${TEMP_Y1} L${x},${yTop + r} Q${x},${yTop} ${x + r},${yTop} L${x + barW - r},${yTop} Q${x + barW},${yTop} ${x + barW},${yTop + r} L${x + barW},${TEMP_Y1} Z"/>`,
    );
    if (i === maxPrecipIdx) {
      g.labels.push(`<text x="${xOf(p.epoch)}" y="${yTop - 4}" class="bar-label" text-anchor="middle">${p.precip} mm</text>`);
    }
  });

  // --- temperature + wind lines (history solid, forecast dashed)
  for (const [key, yFn, cls] of [["temp", yTemp, "temp-line"], ["wind", yWind, "wind-line"]]) {
    const hist = points.filter((p) => p.kind === "history" && typeof p[key] === "number")
      .map((p) => ({ x: xOf(p.epoch), y: yFn(p[key]) }));
    const lastHist = points.filter((p) => p.kind === "history" && typeof p[key] === "number").pop();
    const fc = points.filter((p) => p.kind === "forecast" && typeof p[key] === "number")
      .map((p) => ({ x: xOf(p.epoch), y: yFn(p[key]) }));
    if (lastHist && fc.length) fc.unshift({ x: xOf(lastHist.epoch), y: yFn(lastHist[key]) });
    const clip = key === "temp" ? "clip-temp" : "clip-wind";
    if (hist.length) g.marks.push(`<path class="${cls}" clip-path="url(#${clip})" d="${smoothPath(hist)}"/>`);
    if (fc.length > 1) g.marks.push(`<path class="${cls} forecast" clip-path="url(#${clip})" d="${smoothPath(fc)}"/>`);
  }

  // --- baselines
  g.axis.push(`<line x1="${M_LEFT}" y1="${TEMP_Y1}" x2="${VB_W - M_RIGHT}" y2="${TEMP_Y1}" class="baseline"/>`);
  g.axis.push(`<line x1="${M_LEFT}" y1="${WIND_Y1}" x2="${VB_W - M_RIGHT}" y2="${WIND_Y1}" class="baseline"/>`);

  return `<svg class="meteogram" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-label="Temperature, precipitation and wind history">
    <defs>
      <clipPath id="clip-temp"><rect x="${M_LEFT}" y="${TEMP_Y0 - 2}" width="${INNER_W}" height="${TEMP_H + 4}"/></clipPath>
      <clipPath id="clip-wind"><rect x="${M_LEFT}" y="${WIND_Y0 - 2}" width="${INNER_W}" height="${WIND_H + 4}"/></clipPath>
    </defs>
    <g>${g.grid.join("")}</g>
    <g>${g.axis.join("")}</g>
    <g>${g.marks.join("")}</g>
    <g>${g.labels.join("")}</g>
    <line class="crosshair" x1="0" x2="0" y1="${TEMP_Y0}" y2="${WIND_Y1}" visibility="hidden"/>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Crosshair + tooltip (also keyboard-driven with arrow keys)
// ---------------------------------------------------------------------------

function attachHoverLayer(wrapper, points) {
  const svg = wrapper.querySelector("svg.meteogram");
  const crosshair = svg.querySelector(".crosshair");
  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.hidden = true;
  wrapper.appendChild(tooltip);

  const t0 = points[0].epoch;
  const t1 = points[points.length - 1].epoch;
  const xOf = (epoch) =>
    t1 === t0 ? M_LEFT + INNER_W / 2 : M_LEFT + ((epoch - t0) / (t1 - t0)) * INNER_W;

  function fillTooltip(p) {
    tooltip.textContent = "";
    const head = document.createElement("div");
    head.className = "tt-head";
    head.textContent = `${p.nz.weekday} ${p.nz.day} ${p.nz.month}, ${String(p.nz.hour).padStart(2, "0")}:00`;
    tooltip.appendChild(head);
    const rows = [
      ["temp", typeof p.temp === "number" ? `${p.temp.toFixed(1)}°C` : "–", "Temperature"],
      ["precip", `${(p.precip ?? 0).toFixed(1)} mm`, "Precipitation"],
      ["wind", typeof p.wind === "number" ? `${Math.round(p.wind)} km/h ${compass(p.dir)}` : "–", "Wind"],
      ["wind", typeof p.gust === "number" ? `${Math.round(p.gust)} km/h` : "–", "Gusts"],
    ];
    for (const [series, value, label] of rows) {
      const row = document.createElement("div");
      row.className = "tt-row";
      const key = document.createElement("span");
      key.className = `tt-key tt-key-${series}`;
      const val = document.createElement("strong");
      val.textContent = value;
      const lab = document.createElement("span");
      lab.className = "tt-label";
      lab.textContent = label;
      row.append(key, val, lab);
      tooltip.appendChild(row);
    }
    if (p.kind === "forecast") {
      const note = document.createElement("div");
      note.className = "tt-note";
      note.textContent = "Forecast";
      tooltip.appendChild(note);
    }
  }

  function show(idx) {
    const p = points[idx];
    const vx = xOf(p.epoch);
    crosshair.setAttribute("x1", vx);
    crosshair.setAttribute("x2", vx);
    crosshair.setAttribute("visibility", "visible");
    fillTooltip(p);
    tooltip.hidden = false;
    const scale = wrapper.clientWidth / VB_W;
    const px = vx * scale;
    const flip = px > wrapper.clientWidth * 0.62;
    tooltip.style.left = flip ? "auto" : `${px + 12}px`;
    tooltip.style.right = flip ? `${wrapper.clientWidth - px + 12}px` : "auto";
    tooltip.style.top = `${TEMP_Y0 * scale}px`;
  }

  function hide() {
    crosshair.setAttribute("visibility", "hidden");
    tooltip.hidden = true;
  }

  let kbIdx = points.length - 1;

  svg.addEventListener("pointermove", (ev) => {
    const rect = svg.getBoundingClientRect();
    const vx = ((ev.clientX - rect.left) / rect.width) * VB_W;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(xOf(p.epoch) - vx);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    kbIdx = best;
    show(best);
  });
  svg.addEventListener("pointerleave", hide);

  wrapper.tabIndex = 0;
  wrapper.setAttribute("aria-label", "Weather history chart. Use arrow keys to inspect values.");
  wrapper.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
      ev.preventDefault();
      kbIdx = Math.min(points.length - 1, Math.max(0, kbIdx + (ev.key === "ArrowRight" ? 1 : -1)));
      show(kbIdx);
    } else if (ev.key === "Escape") {
      hide();
    }
  });
  wrapper.addEventListener("focus", () => show(kbIdx));
  wrapper.addEventListener("blur", hide);
}

// ---------------------------------------------------------------------------
// Table view (the no-hover twin of the chart)
// ---------------------------------------------------------------------------

function buildDataTable(points) {
  const details = document.createElement("details");
  details.className = "data-table";
  const summary = document.createElement("summary");
  summary.textContent = "View data as table";
  details.appendChild(summary);

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const h of ["Time (NZ)", "Temp °C", "Feels °C", "Precip mm", "Wind km/h", "Gusts km/h", "Direction"]) {
    const th = document.createElement("th");
    th.textContent = h;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const p of points) {
    const tr = document.createElement("tr");
    const cells = [
      `${p.nz.weekday} ${p.nz.day} ${p.nz.month} ${String(p.nz.hour).padStart(2, "0")}:00${p.kind === "forecast" ? " (forecast)" : ""}`,
      typeof p.temp === "number" ? p.temp.toFixed(1) : "–",
      typeof p.feels === "number" ? p.feels.toFixed(1) : "–",
      (p.precip ?? 0).toFixed(1),
      typeof p.wind === "number" ? Math.round(p.wind) : "–",
      typeof p.gust === "number" ? Math.round(p.gust) : "–",
      compass(p.dir) || "–",
    ];
    cells.forEach((c, i) => {
      const td = document.createElement("td");
      td.textContent = String(c);
      if (i > 0) td.className = "num";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  details.appendChild(table);
  return details;
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function renderSidebar() {
  const listEl = document.getElementById("location-list");
  listEl.textContent = "";
  for (const loc of state.locations) {
    const obs = state.currentByLoc[loc.id];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "loc-item";
    if (loc.id === state.selectedId) {
      btn.classList.add("active");
      btn.setAttribute("aria-current", "true");
    }
    const name = document.createElement("span");
    name.className = "loc-name";
    name.textContent = loc.name;
    const meta = document.createElement("span");
    meta.className = "loc-meta";
    if (obs && typeof obs.temp_c === "number") {
      const hourNz = nzParts(obs.fetched_at).hour;
      meta.textContent = `${weatherEmoji(obs.weather_code, hourNz)} ${Math.round(obs.temp_c)}°C · ${weatherLabel(obs.weather_code)}`;
    } else {
      meta.textContent = "No data yet";
    }
    btn.append(name, meta);
    btn.addEventListener("click", () => selectLocation(loc.id));
    listEl.appendChild(btn);
  }
}

function renderPrimaryShell(loc, obs) {
  const el = document.getElementById("primary");
  const hourNz = obs ? nzParts(obs.fetched_at).hour : 12;
  const currentHtml = obs
    ? `<p class="observed-at">Observed ${esc(formatObservedAt(obs.observed_at))}</p>
      <div class="temp-row">
        <span class="wx-emoji" aria-hidden="true">${weatherEmoji(obs.weather_code, hourNz)}</span>
        <span class="temp">${Math.round(obs.temp_c)}°C</span>
        <span class="condition">${esc(weatherLabel(obs.weather_code))}</span>
      </div>
      <div class="details">
        <span>Feels like <strong>${Math.round(obs.apparent_temp_c)}°C</strong></span>
        <span>Humidity <strong>${obs.humidity_pct}%</strong></span>
        <span>Wind <strong>${Math.round(obs.wind_kmh)} km/h ${compass(obs.wind_dir_deg)}</strong></span>
        <span>Gusts <strong>${Math.round(obs.wind_gust_kmh)} km/h</strong></span>
      </div>`
    : `<p class="error">No data yet for this location.</p>`;

  const rangeButtons = RANGES.map((r) =>
    `<button type="button" class="range-btn${r.hours === state.hours ? " active" : ""}" data-hours="${r.hours}" aria-pressed="${r.hours === state.hours}">${r.label}</button>`,
  ).join("");

  el.innerHTML = `
    <div class="card current-card">
      <h2>${esc(loc.name)}</h2>
      ${currentHtml}
    </div>
    <div class="card chart-card">
      <div class="chart-header">
        <h3>History</h3>
        <div class="range-row" role="group" aria-label="Time range">${rangeButtons}</div>
      </div>
      <div class="chart-wrapper" id="chart-wrapper"><p class="loading">Loading history…</p></div>
      <div class="legend">
        <span class="legend-item"><span class="key key-line key-temp"></span>Temperature °C</span>
        <span class="legend-item"><span class="key key-rect key-precip"></span>Precipitation mm</span>
        <span class="legend-item"><span class="key key-line key-wind"></span>Wind km/h</span>
      </div>
      <div id="table-slot"></div>
    </div>`;

  el.querySelectorAll(".range-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.hours = Number(btn.dataset.hours);
      localStorage.setItem("ttw.hours", String(state.hours));
      el.querySelectorAll(".range-btn").forEach((b) => {
        const on = Number(b.dataset.hours) === state.hours;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      loadChart();
    });
  });
}

async function loadChart() {
  const wrapper = document.getElementById("chart-wrapper");
  if (!wrapper) return;
  // hold the previous render at reduced opacity while refetching
  wrapper.classList.add("reloading");
  try {
    const res = await fetch(`/api/series?loc=${state.selectedId}&hours=${state.hours}`);
    const series = await res.json();
    const points = buildPoints(series);
    wrapper.classList.remove("reloading");
    const tableSlot = document.getElementById("table-slot");
    tableSlot.textContent = "";
    if (points.length < 2) {
      wrapper.innerHTML = `<p class="loading">Not enough history yet — check back after a few more pulls.</p>`;
      return;
    }
    wrapper.innerHTML = renderMeteogram(points);
    attachHoverLayer(wrapper, points);
    tableSlot.appendChild(buildDataTable(points));
  } catch (err) {
    console.error(err);
    wrapper.classList.remove("reloading");
    wrapper.innerHTML = `<p class="error">Couldn't load history.</p>`;
  }
}

function selectLocation(id) {
  state.selectedId = id;
  localStorage.setItem("ttw.loc", id);
  renderSidebar();
  const loc = state.locations.find((l) => l.id === id);
  renderPrimaryShell(loc, state.currentByLoc[id]);
  loadChart();
}

async function init() {
  const primaryEl = document.getElementById("primary");
  try {
    const [locationsRes, currentRes] = await Promise.all([
      fetch("/api/locations").then((r) => r.json()),
      fetch("/api/current").then((r) => r.json()),
    ]);
    state.locations = locationsRes.locations;
    state.currentByLoc = Object.fromEntries(
      currentRes.observations.map((o) => [o.location_id, o]),
    );
    if (!state.locations.some((l) => l.id === state.selectedId)) {
      state.selectedId = state.locations[0]?.id ?? null;
    }
    if (!state.selectedId) {
      primaryEl.innerHTML = `<p class="error">No locations configured.</p>`;
      return;
    }
    selectLocation(state.selectedId);
  } catch (err) {
    console.error(err);
    primaryEl.innerHTML = `<p class="error">Couldn't load weather data. Please try again later.</p>`;
  }
}

init();
