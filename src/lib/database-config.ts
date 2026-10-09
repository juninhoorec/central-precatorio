import { createClient, type Client } from "@libsql/client";

export const LOCAL_DATABASE_URL = "file:central-precatorios.db";

type DatabaseConfig = {
  url: string;
  authToken?: string;
  isRemote: boolean;
};

function fail(code: string): never {
  throw new Error(code);
}

export function resolveDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const url = env.DATABASE_URL?.trim();
  const authToken = env.DATABASE_AUTH_TOKEN?.trim();
  const strictProduction = env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build";

  if (!url) {
    if (strictProduction) fail("DATABASE_CONFIG_MISSING");
    return { url: LOCAL_DATABASE_URL, isRemote: false };
  }

  const isLocal = url.startsWith("file:");
  if (strictProduction && isLocal) fail("DATABASE_CONFIG_LOCAL_FORBIDDEN");

  const isRemote = !isLocal;
  if (strictProduction && isRemote && !authToken) fail("DATABASE_CONFIG_AUTH_TOKEN_MISSING");
  return { url, ...(authToken ? { authToken } : {}), isRemote };
}

export function createDatabaseClient(): Client {
  const config = resolveDatabaseConfig();
  return createClient(config);
}

export function databaseConfigForDialect() {
  const { url, authToken } = resolveDatabaseConfig();
  return { url, authToken };
}
