import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)));
const REPO_ROOT = resolve(CONFIG_DIR, "..", "..", "..");

/**
 * Loads the repository-root `.env.local` into process.env without
 * overwriting already-set variables (dotenv semantics). Resolves from the
 * repo root regardless of the process working directory, so the worker and
 * CLI scripts share one env file.
 */
export function loadRootEnv(): void {
  const path = resolve(REPO_ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1] as string;
    if (!(key in process.env)) {
      process.env[key] = match[2]?.replace(/^["']|["']$/g, "") ?? "";
    }
  }
}
