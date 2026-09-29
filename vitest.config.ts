import { defineConfig } from "vitest/config";
import { existsSync } from "fs";
import path from "path";

// Service tests run against a real Postgres (Section 13.1). By default that is a separate
// `test` schema on the DIRECT_URL database, so dev data is never touched; set
// TEST_DATABASE_URL to use a dedicated Neon test branch instead.
if (existsSync(".env")) process.loadEnvFile(".env");
const env = { ...process.env };
const base = env.TEST_DATABASE_URL || env.DIRECT_URL;
let testDbUrl = "";
if (base) {
  const url = new URL(base);
  if (!env.TEST_DATABASE_URL) url.searchParams.set("schema", "test");
  testDbUrl = url.toString();
}

// globalSetup runs in this process and reads these.
process.env.DATABASE_URL = testDbUrl;
process.env.DIRECT_URL = testDbUrl;

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup/global-db.ts"],
    // Test files share one database and reset it between files, so run them one at a time.
    fileParallelism: false,
    // Remote Postgres: each round-trip costs tens of ms, and Neon may cold-start.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: testDbUrl,
      DIRECT_URL: testDbUrl,
      AUTH_SECRET: env.AUTH_SECRET || "test-secret-at-least-32-characters-long",
      APP_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
