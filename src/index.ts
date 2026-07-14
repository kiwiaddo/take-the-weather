import { handleRequest } from "./router";
import { runPull } from "./pull";
import type { Env } from "./types";

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
