/**
 * Next.js instrumentation — runs once at server startup (and during the
 * build's static-generation phase) before any page executes.
 *
 * Loads the repository-root `.env.local` into process.env so the web app
 * shares the single env source with the worker, scripts and tests (Next 16
 * only loads `.env*` from the app folder and no longer supports `envDir`).
 *
 * The Node-only loader lives in a separate module so the Edge instrumentation
 * bundle (which cannot use `node:path`/`node:url`) stays empty.
 */
import { loadRootEnv } from "./instrumentation.node";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }
  loadRootEnv();
}
