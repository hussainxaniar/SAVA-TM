import { execSync } from "node:child_process";

// Brings the test database schema up to date once per run.
export default function setup() {
  if (!process.env.DATABASE_URL) {
    throw new Error("No test database: set DIRECT_URL (uses its `test` schema) or TEST_DATABASE_URL in .env");
  }
  execSync("prisma migrate deploy", { stdio: "pipe", env: process.env });
}
