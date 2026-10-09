/** Explicit target guard for operational scripts. */
type ScriptEnvironment = Record<string, string | undefined>;

export function requireExplicitDatabaseUrl(env: ScriptEnvironment = process.env): string {
  const value = env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_REQUIRED_FOR_OPERATIONAL_SCRIPT");
  if (value === "file:central-precatorios.db") throw new Error("AUTHORIZED_DATABASE_TARGET_REQUIRED");
  return value;
}

export function requireIsolatedE2EDatabaseUrl(env: ScriptEnvironment = process.env): string {
  const value = requireExplicitDatabaseUrl(env);
  if (value.startsWith("file:") && value.endsWith("central-precatorios.db")) throw new Error("E2E_REQUIRES_ISOLATED_DATABASE");
  return value;
}
