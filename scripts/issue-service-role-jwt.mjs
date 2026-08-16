#!/usr/bin/env node
/**
 * Prints a service-role JWT signed with the local Supabase demo secret.
 *
 * The standard local Supabase keys work with the default demo stack; if the
 * local stack's GoTrue JWT secret has been changed, use this to mint a fresh
 * service-role token for SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage: node scripts/issue-service-role-jwt.mjs
 */

import { createHmac } from "node:crypto";

const secret = process.env.GOTRUE_JWT_SECRET ?? process.argv[2] ?? null;
if (!secret) {
  console.error(
    "Usage: GOTRUE_JWT_SECRET=<secret> node scripts/issue-service-role-jwt.mjs",
  );
  process.exit(1);
}

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const header = { alg: "HS256", typ: "JWT" };
const payload = {
  iss: "supabase-demo",
  role: "service_role",
  exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
};
const signingInput = `${b64(header)}.${b64(payload)}`;
const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");

console.log(`${signingInput}.${signature}`);
