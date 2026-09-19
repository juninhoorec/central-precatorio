import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  fullyParallel:false,
  retries:0,
  reporter:"list",
  timeout:120_000,
  use:{baseURL:"http://localhost:3108",trace:"retain-on-failure",screenshot:"only-on-failure"},
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}],
  webServer:{command:"npm run auth:migrate -- --apply && npm run migrate:domain -- --apply && npm run dev -- --hostname localhost --port 3108",url:"http://localhost:3108",reuseExistingServer:false,timeout:120_000,env:{DATABASE_URL:"file:cp-lead-center-e2e.db",BETTER_AUTH_SECRET:"cp-lead-center-e2e-secret-key-32-characters-minimum",BETTER_AUTH_URL:"http://localhost:3108",NODE_ENV:"development"}},
});
