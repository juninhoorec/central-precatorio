import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { requireExplicitDatabaseUrl, requireIsolatedE2EDatabaseUrl } from "./database-target.mjs";

describe("operational script database target", () => {
  it("requires an explicit target", () => {
    expect(() => requireExplicitDatabaseUrl({})).toThrow("DATABASE_URL_REQUIRED_FOR_OPERATIONAL_SCRIPT");
    expect(() => requireExplicitDatabaseUrl({ DATABASE_URL: "file:central-precatorios.db" })).toThrow("AUTHORIZED_DATABASE_TARGET_REQUIRED");
  });

  it("accepts an explicit non-operational target without connecting", () => {
    expect(requireExplicitDatabaseUrl({ DATABASE_URL: "file:isolated-test.db" })).toBe("file:isolated-test.db");
    expect(requireExplicitDatabaseUrl({ DATABASE_URL: "https://database.example.test", DATABASE_AUTH_TOKEN: "redacted-test-token" })).toBe("https://database.example.test");
  });

  it("keeps E2E scripts away from the operational database", () => {
    expect(() => requireIsolatedE2EDatabaseUrl({ DATABASE_URL: "file:central-precatorios.db" })).toThrow("AUTHORIZED_DATABASE_TARGET_REQUIRED");
    expect(requireIsolatedE2EDatabaseUrl({ DATABASE_URL: "file:e2e-isolated.db" })).toBe("file:e2e-isolated.db");
  });

  it("has no implicit fallback in protected operational scripts", () => {
    const protectedScripts = [
      "ai-reconfirmation-benchmark-dry-run.mts", "first-operational-batch.mts", "migrate-domain.mts",
      "phase2-titular-enrichment.mts", "phase4-opportunity-enrichment.mts", "phase5-official-enrichment.mts",
      "phase6-migrate.mts", "phase7-backup-restore.mts", "phase8-backfill-events.mts", "phase8-enrichment.mts",
      "phase9-pilot-reconcile.mts", "phase9-pilot.mts", "run-pilot.mts",
    ];
    const fallback = /process\.env\.DATABASE_URL\s*\|\|/;
    const offenders = protectedScripts.filter((name) => fallback.test(readFileSync(join(process.cwd(), "scripts", name), "utf8")));
    expect(offenders).toEqual([]);
  });
});
