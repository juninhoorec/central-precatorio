import nextEnv from"@next/env";const{loadEnvConfig}=nextEnv;loadEnvConfig(process.cwd());
if(!process.argv.includes("--apply")){console.error("Migração não executada. Faça backup e execute npm run migrate:domain -- --apply.");process.exit(1)}
const{createClient}=await import("@libsql/client");const db=createClient({url:process.env.DATABASE_URL||"file:central-precatorios.db",authToken:process.env.DATABASE_AUTH_TOKEN});
await db.execute("CREATE TABLE IF NOT EXISTS cp_migrations (version TEXT PRIMARY KEY,applied_at TEXT NOT NULL)");const applied=await db.execute("SELECT version FROM cp_migrations");const done=new Set(applied.rows.map(r=>String(r.version)));
const migrations=[{version:"20260919_cp21_foundation",run:async()=>{const{initializeOperations}=await import("../src/lib/operations.ts");const{initializeAudit}=await import("../src/lib/audit.ts");const{initializeDocumentStorage}=await import("../src/lib/document-storage.ts");await initializeOperations(db);await initializeDocumentStorage(db);await initializeAudit(db)}}];
for(const migration of migrations){if(done.has(migration.version))continue;await migration.run();await db.execute({sql:"INSERT INTO cp_migrations(version,applied_at) VALUES (?,?)",args:[migration.version,new Date().toISOString()]});console.log(`Aplicada: ${migration.version}`)}
console.log("Migrações de domínio concluídas.");db.close();process.exit(0);
