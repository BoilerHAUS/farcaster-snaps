import { serve } from "@hono/node-server";
import app from "./index.js";

/*
  Local dev only. Excluded from host.neynar.app deployment.
  Uses @hono/node-server which is incompatible with the Vercel Edge runtime.
*/

const port = Number(process.env.PORT ?? "3002");

serve({ fetch: app.fetch, port });

console.log(`eggs-unstaker snap listening on http://localhost:${port}`);
