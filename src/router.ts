import { ATTRIBUTION, LOCATIONS } from "./config";
import { aggregateForLocation } from "./aggregate";
import { history, latestPerLocation } from "./store";
import type { Env } from "./types";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isKnownLocation(id: string | null): id is (typeof LOCATIONS)[number]["id"] {
  return id !== null && LOCATIONS.some((l) => l.id === id);
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/api/locations") {
    return json({ source: ATTRIBUTION, locations: LOCATIONS });
  }

  if (pathname === "/api/current") {
    const rows = await latestPerLocation(env.DB);
    return json({ source: ATTRIBUTION, observations: rows });
  }

  if (pathname === "/api/history") {
    const loc = url.searchParams.get("loc");
    if (!isKnownLocation(loc)) {
      return json({ error: "unknown or missing 'loc' query param" }, 400);
    }
    const hours = Number(url.searchParams.get("hours") ?? "48");
    if (!Number.isFinite(hours) || hours <= 0) {
      return json({ error: "'hours' must be a positive number" }, 400);
    }
    const rows = await history(env.DB, loc, hours);
    return json({ source: ATTRIBUTION, location_id: loc, hours, observations: rows });
  }

  if (pathname === "/api/aggregate") {
    const loc = url.searchParams.get("loc");
    if (!isKnownLocation(loc)) {
      return json({ error: "unknown or missing 'loc' query param" }, 400);
    }
    const days = Number(url.searchParams.get("days") ?? "7");
    if (!Number.isFinite(days) || days <= 0) {
      return json({ error: "'days' must be a positive number" }, 400);
    }
    const stats = await aggregateForLocation(env.DB, loc, days);
    return json({ source: ATTRIBUTION, days, ...stats });
  }

  // Static frontend assets (public/) are served via the Workers assets binding.
  return env.ASSETS.fetch(request);
}
