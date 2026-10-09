import { afterEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { LOCAL_DATABASE_URL, resolveDatabaseConfig } from "./database-config";

const original = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, original);
});

describe("database configuration safety", () => {
  it("has no independent local fallback in runtime routes or libraries", () => {
    const root = join(process.cwd(), "src");
    const files: string[] = [];
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory)) {
        const path = join(directory, entry);
        if (statSync(path).isDirectory()) visit(path);
        else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) files.push(path);
      }
    };
    visit(root);
    const fallback = /process\.env\.DATABASE_URL\s*\|\|/;
    expect(files.filter((path) => fallback.test(readFileSync(path, "utf8")))).toEqual([]);
  });

  it("fails closed in production when DATABASE_URL is absent", () => {
    expect(() => resolveDatabaseConfig({ NODE_ENV: "production" })).toThrow("DATABASE_CONFIG_MISSING");
  });

  it("rejects a local file database in production", () => {
    expect(() => resolveDatabaseConfig({ NODE_ENV: "production", DATABASE_URL: LOCAL_DATABASE_URL, DATABASE_AUTH_TOKEN: "secret-value" })).toThrow("DATABASE_CONFIG_LOCAL_FORBIDDEN");
  });

  it("accepts a remote URL with the required credential without connecting", () => {
    expect(resolveDatabaseConfig({ NODE_ENV: "production", DATABASE_URL: "https://database.example.test", DATABASE_AUTH_TOKEN: "secret-value" })).toEqual({ url: "https://database.example.test", authToken: "secret-value", isRemote: true });
  });

  it("requires credentials for a remote production URL", () => {
    expect(() => resolveDatabaseConfig({ NODE_ENV: "production", DATABASE_URL: "https://database.example.test" })).toThrow("DATABASE_CONFIG_AUTH_TOKEN_MISSING");
  });

  it("preserves the local fallback outside production", () => {
    expect(resolveDatabaseConfig({ NODE_ENV: "development" })).toEqual({ url: LOCAL_DATABASE_URL, isRemote: false });
    expect(resolveDatabaseConfig({ NODE_ENV: "test" })).toEqual({ url: LOCAL_DATABASE_URL, isRemote: false });
  });

  it("does not put secrets in configuration errors", () => {
    const secret = "do-not-print-this-token";
    try { resolveDatabaseConfig({ NODE_ENV: "production", DATABASE_URL: "https://db.example.test", DATABASE_AUTH_TOKEN: secret }); } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
    expect(() => resolveDatabaseConfig({ NODE_ENV: "production" })).toThrow("DATABASE_CONFIG_MISSING");
  });
});
