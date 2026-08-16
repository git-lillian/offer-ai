import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@offer-ai/database": resolve(__dirname, "../../packages/database/src/index.ts"),
      "@offer-ai/config": resolve(__dirname, "../../packages/config/src/index.ts"),
      "@offer-ai/contracts": resolve(__dirname, "../../packages/contracts/src/index.ts"),
      "@offer-ai/domain": resolve(__dirname, "../../packages/domain/src/index.ts"),
      "@offer-ai/ai": resolve(__dirname, "../../packages/ai/src/index.ts"),
    },
  },
});
