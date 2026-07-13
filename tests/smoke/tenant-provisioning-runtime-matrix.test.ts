import { describe, expect, it } from "vitest";

const base = process.env.STAGING_STOREFRONT_URL;
const token = process.env.PROVISIONING_API_KEY;
const maybe = base && token ? describe : describe.skip;

maybe("Mission 1 tenant provisioning staging matrix", () => {
  it("keeps workflow controls private and exposes canonical health", async () => {
    const spoof = await fetch(`${base}/provisioning/workflow/health`, {
      headers: { "X-Pagayo-Internal": "true" },
    });
    expect([401, 403]).toContain(spoof.status);

    const health = await fetch(`${base}/provisioning/workflow/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(health.status).toBe(200);
  });

  it("exposes persisted run/readiness endpoints as protected operator contracts", async () => {
    const anonymous = await fetch(`${base}/provisioning/runtime/repairs`);
    expect([401, 403]).toContain(anonymous.status);

    const authenticated = await fetch(`${base}/provisioning/runtime/repairs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(authenticated.status).toBe(200);
  });
});
