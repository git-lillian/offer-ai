import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves the repository root (the directory containing `pnpm-workspace.yaml`).
 *
 * The source-layout resolution (`import.meta.url`) is exact for unbundled
 * entry points (worker, CLI scripts, tests) but breaks when the module is
 * bundled (Next.js server bundles compile it into `.next/server/...`). The
 * walk-up from the process working directory covers every entry point: all
 * pnpm scripts run with the package directory as cwd, and the workspace root
 * is always an ancestor.
 */
function findRepoRoot(): string {
  const sourceRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
  if (existsSync(resolve(sourceRoot, "pnpm-workspace.yaml"))) {
    return sourceRoot;
  }
  let dir = process.cwd();
  for (let depth = 0; depth < 8; depth++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const REPO_ROOT = findRepoRoot();

/**
 * Loads the repository-root `.env.local` into process.env without
 * overwriting already-set variables (dotenv semantics). Resolves from the
 * repo root regardless of the process working directory, so the worker, the
 * web app (via instrumentation) and CLI scripts share one env file.
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
