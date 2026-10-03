# CP — Final Operations Runbook

## Startup

1. Configure `DATABASE_URL` and `DATABASE_AUTH_TOKEN` on the server only.
2. Run `node --import tsx scripts/apply-schema-migrations.mts` before starting web or worker processes. Runtime services only verify migration state and refuse unmigrated databases.
3. Start the web application and the bounded automation worker separately.
4. Verify `/api/health` and authenticated tenant access before enabling jobs.

## Deterministic invariants

- DEPRE is the primary judicial identifier.
- Source failures remain source failures; they are not global absence.
- Evidence is created only through candidate construction, deterministic resolution, and the existing persistence service.
- DOCUMENTAÇÃO 2/2 requires two distinct qualifying official documents.
- Availability and original imported values are independent from AI, CRM, and automation.

## Automation safety

Jobs are tenant-scoped, idempotent, leased, bounded by retry caps, and recoverable after lease expiry. CAPTCHA, authentication, and manual-required states do not retry automatically. Do not enable unrestricted recurring schedules or process the full inventory.

## Backup and restore

Back up the database file or configured database service before schema changes. Verify the backup by restoring it to an isolated database and checking operation counts, unique DEPRE count, evidence count, audit-chain integrity, and CRM/automation tables. Never include API keys or credentials in database backups or exported configuration.

## Rollback

Stop web and worker processes, restore the last verified database backup, re-run only compatible schema initialization, and verify the same integrity counts before reopening traffic. Never use destructive reset commands against the operational database.

## Secrets

Provider keys are server-side environment configuration only. The application may expose provider/model/key-present metadata, never the key itself. DeepSeek external verification remains pending when the runtime cannot see its credential.

## Known external dependencies

- DeepSeek credential visibility in the execution environment.
- Browser-authenticated E2E tooling.
- Authorization and rate limits of official judicial sources.
