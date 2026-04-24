import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

import {
  EXIT_CODES,
  parseWarnDays,
  daysUntil,
  evaluateSeverity,
  mapWarnMatches,
} from "../../scripts/cloudflare/token-expiry-check.mjs";

describe("Cloudflare token expiry helpers", () => {
  it("parseWarnDays dedupliceert en sorteert aflopend", () => {
    expect(parseWarnDays("14,30,7,14,3,1")).toEqual([30, 14, 7, 3, 1]);
  });

  it("daysUntil berekent dagen in UTC-consistente manier", () => {
    const now = new Date("2026-04-22T00:00:00.000Z");
    const fiveDaysLater = "2026-04-27T00:00:00.000Z";
    expect(daysUntil(fiveDaysLater, now)).toBe(5);
  });

  it("evaluateSeverity markeert null expires_on als critical", () => {
    const result = evaluateSeverity({
      tokenStatus: "active",
      expiresOn: null,
      daysRemaining: null,
      criticalDays: 3,
    });

    expect(result.severity).toBe("critical");
    expect(result.exitCode).toBe(EXIT_CODES.CRITICAL);
  });

  it("evaluateSeverity markeert <=1 dag als emergency", () => {
    const result = evaluateSeverity({
      tokenStatus: "active",
      expiresOn: "2026-04-23T00:00:00.000Z",
      daysRemaining: 1,
      criticalDays: 3,
    });

    expect(result.severity).toBe("emergency");
    expect(result.exitCode).toBe(EXIT_CODES.CRITICAL);
  });

  it("evaluateSeverity markeert <=7 dagen als high", () => {
    const result = evaluateSeverity({
      tokenStatus: "active",
      expiresOn: "2026-04-29T00:00:00.000Z",
      daysRemaining: 7,
      criticalDays: 3,
    });

    expect(result.severity).toBe("high");
    expect(result.exitCode).toBe(EXIT_CODES.HIGH);
  });

  it("mapWarnMatches geeft alle relevante drempels terug", () => {
    expect(mapWarnMatches(5, [30, 14, 7, 3, 1])).toEqual([30, 14, 7]);
  });
});

describe("Cloudflare token expiry CLI", () => {
  const scriptPath = "scripts/cloudflare/token-expiry-check.mjs";
  const nodeExecutable = process.execPath;

  const parseJsonOutput = <T>(rawOutput: string, context: string): T => {
    const trimmedOutput = rawOutput.trim();

    if (!trimmedOutput) {
      throw new Error(`${context}: CLI gaf lege stdout terug; verwachtte JSON output.`);
    }

    try {
      return JSON.parse(trimmedOutput) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${context}: ongeldige JSON output (${message}). Ontvangen stdout: ${trimmedOutput}`,
      );
    }
  };

  it("dry-run json mode retourneert success payload", () => {
    const output = execFileSync(nodeExecutable, [scriptPath, "--dry-run", "--json"], {
      cwd: "/Users/sjoerdoverdiep/my-vscode-workspace/pagayo-maintenance",
      encoding: "utf-8",
    });

    const parsed = parseJsonOutput<{
      success: boolean;
      simulated: boolean;
      severity: string;
      daysUntilExpiry: number;
    }>(output, "dry-run json mode");

    expect(parsed.success).toBe(true);
    expect(parsed.simulated).toBe(true);
    expect(parsed.severity).toBe("ok");
    expect(parsed.daysUntilExpiry).toBeGreaterThan(0);
  });

  it("zonder token geeft config failure", () => {
    let capturedStdout = "";
    let capturedStatus = -1;

    try {
      execFileSync(nodeExecutable, [scriptPath, "--json"], {
        cwd: "/Users/sjoerdoverdiep/my-vscode-workspace/pagayo-maintenance",
        encoding: "utf-8",
        env: {
          PATH: process.env.PATH ?? "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      const err = error as { stdout?: string; status?: number };
      capturedStdout = err.stdout ?? "";
      capturedStatus = err.status ?? -1;
    }

    const parsed = parseJsonOutput<{
      success: boolean;
      error: { code: string };
    }>(capturedStdout, "zonder token json mode");

    expect(capturedStatus).toBe(EXIT_CODES.FAILURE);
    expect(parsed.success).toBe(false);
    expect(parsed.error.code).toBe("TOKEN_MISSING");
  });
});
