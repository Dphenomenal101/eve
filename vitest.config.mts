import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
  resolve: { conditions: ["convex", "module", "default"] },
});
