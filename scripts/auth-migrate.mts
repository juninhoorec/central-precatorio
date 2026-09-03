import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
if (!process.argv.includes("--apply")) {
  console.error("Migração não executada. Faça backup e execute node scripts/auth-migrate.mts --apply.");
  process.exit(1);
}
const { getMigrations } = await import("better-auth/db/migration");
const { auth } = await import("../src/lib/auth.ts");
const migration = await getMigrations(auth.options);
await migration.runMigrations();
console.log("Migrações de autenticação aplicadas. Nenhuma conta foi criada.");
process.exit(0);
