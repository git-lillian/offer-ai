import { createHash } from "node:crypto";

/**
 * Deterministic content hash for ingestion snapshots.
 * SHA-256 hex, stable across runs.
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Returns true when two hashes represent identical content.
 * Constant-time comparison to avoid timing leaks (defence in depth).
 */
export function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
