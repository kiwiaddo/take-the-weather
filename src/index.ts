import { LOCATIONS } from "./config";
import { fetchWeather } from "./openmeteo";
import { handleRequest } from "./router";
import { insertObservations, toObservation } from "./store";
import type { Env } from "./types";

export async function runPull(env: Env): Promise<void> {
  const fetchedAt = new Date().toISOString();
  const results = await fetchWeather(LOCATIONS);
  const rows = results.map((r) => toObservation(r, fetchedAt));
  await insertObservations(env.DB, rows);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runPull(env).catch((err) => {
        console.error("scheduled weather pull failed:", err);
      }),
    );
  },
};
