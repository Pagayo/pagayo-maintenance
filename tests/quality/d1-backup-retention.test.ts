import { describe, it, expect } from "vitest";

import { evaluateRetention } from "../../scripts/d1-backup-retention.mjs";

describe("D1 backup retention (Mission 7)", () => {
  it("marks scheduled backups expired after 30 days", () => {
    const now = new Date("2026-07-16T00:00:00.000Z");
    const result = evaluateRetention({
      trigger: "scheduled",
      createdAt: "20260615T000000Z",
      now,
    });
    expect(result.retentionDays).toBe(30);
    expect(result.expired).toBe(true);
  });

  it("keeps scheduled backups inside 30-day window", () => {
    const now = new Date("2026-07-16T00:00:00.000Z");
    const result = evaluateRetention({
      trigger: "scheduled",
      createdAt: "20260620T000000Z",
      now,
    });
    expect(result.expired).toBe(false);
  });

  it("uses 90-day retention for manual triggers", () => {
    const now = new Date("2026-07-16T00:00:00.000Z");
    const result = evaluateRetention({
      trigger: "manual",
      createdAt: "20260501T000000Z",
      now,
    });
    expect(result.retentionDays).toBe(90);
    expect(result.expired).toBe(false);
  });

  it("accepts ISO createdAt timestamps", () => {
    const now = new Date("2026-07-16T12:00:00.000Z");
    const result = evaluateRetention({
      trigger: "scheduled",
      createdAt: "2026-06-01T12:00:00.000Z",
      now,
    });
    expect(result.expired).toBe(true);
    expect(result.expiresAt).toBe("2026-07-01T12:00:00.000Z");
  });
});
