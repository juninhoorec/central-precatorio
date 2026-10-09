import { createClient } from "@libsql/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { rateLimit } from "./rate-limit";

describe("atomic rate limit", () => {
  it("admits no more than the configured count under concurrent requests", async () => {
    const client = createClient({ url: ":memory:" });
    const request = new Request("https://cp.test", { headers: { "x-forwarded-for": "198.51.100.20, 203.0.113.9" } });
    const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit(request, "worker", 5, 600, "tenant-a:user-a", client)));

    expect(results.filter(Boolean)).toHaveLength(5);
    const otherUser = await rateLimit(request, "worker", 5, 600, "tenant-a:user-b", client);
    expect(otherUser).toBe(true);
    await client.close();
  });
});
