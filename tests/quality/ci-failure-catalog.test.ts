import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const CATALOG_DIR = join(
  "/Users/sjoerdoverdiep/my-vscode-workspace",
  "pagayo-maintenance/ci-failure-catalog",
);

type LibModule = typeof import("../../ci-failure-catalog/lib.mjs");

async function loadLib(): Promise<LibModule> {
  return import("../../ci-failure-catalog/lib.mjs");
}

describe("ci-failure-catalog", () => {
  it("loads and validates catalog.yaml", async () => {
    const { loadCatalog } = await loadLib();
    const catalog = loadCatalog(join(CATALOG_DIR, "catalog.yaml"));
    expect(catalog.version).toBe(1);
    expect(catalog.entries.length).toBeGreaterThanOrEqual(28);
    const ids = new Set(catalog.entries.map((e) => e.id));
    expect(ids.size).toBe(catalog.entries.length);
  });

  it("rejects invalid catalog entries", async () => {
    const { validateEntry } = await loadLib();
    const errors = validateEntry({ id: "x" });
    expect(errors.length).toBeGreaterThan(0);
  });

  const fixtures: Array<{
    text: string;
    repo?: string;
    expectedId: string;
  }> = [
    {
      text: "npm run design:verify-asset-version failed: DESIGN_ASSET_VERSION mismatch",
      repo: "pagayo-storefront",
      expectedId: "design-asset-version-drift",
    },
    {
      text: "npm ci failed: package-lock.json out of sync",
      expectedId: "lockfile-desync",
    },
    {
      text: "tenant:migration:policy:check failed — missing manifest entry",
      repo: "pagayo-storefront",
      expectedId: "migration-policy-violation",
    },
    {
      text: "Kon pagayo-schema/migrations niet vinden. Zet PAGAYO_SCHEMA_ROOT",
      repo: "pagayo-maintenance",
      expectedId: "schema-root-missing",
    },
    {
      text: "stack-check failed: STACK-MANIFEST drift detected",
      expectedId: "stack-manifest-drift",
    },
    {
      text: "JavaScript heap out of memory in client shard 3",
      repo: "pagayo-storefront",
      expectedId: "client-shard-oom",
    },
    {
      text: "TOKEN_MISSING: Set CLOUDFLARE_API_TOKEN",
      expectedId: "cloudflare-token-missing",
    },
    {
      text: "dependabot private_source_authentication_failure npm.pkg.github.com",
      expectedId: "dependabot-private-registry",
    },
    {
      text: "verify-ci-sha: no successful CI run for commit",
      repo: "pagayo-storefront",
      expectedId: "verify-ci-sha-missing",
    },
    {
      text: "error TS2345: Type string is not assignable",
      expectedId: "typecheck-failure",
    },
  ];

  it.each(fixtures)("matches $expectedId for fixture", async (fixture) => {
    const { loadCatalog, matchCatalog } = await loadLib();
    const catalog = loadCatalog(join(CATALOG_DIR, "catalog.yaml"));
    const entry = matchCatalog(fixture.text, catalog.entries, {
      repo: fixture.repo,
    });
    expect(entry?.id).toBe(fixture.expectedId);
  });

  it("normalizes fingerprints for clustering", async () => {
    const { normalizeFingerprint } = await loadLib();
    const raw =
      "Error at abc123def4567890 on 2026-06-07T12:00:00Z run 24876476459";
    const fp = normalizeFingerprint(raw);
    expect(fp).not.toContain("abc123def4567890");
    expect(fp).not.toContain("24876476459");
    expect(fp).toContain("<sha>");
  });

  it("extracts actionable error from log blob", async () => {
    const { extractActionableError } = await loadLib();
    const log = readFileSync(
      join(CATALOG_DIR, "fixtures/sample-failed-log.txt"),
      "utf-8",
    );
    const snippet = extractActionableError(log);
    expect(snippet.length).toBeGreaterThan(10);
    expect(snippet.toLowerCase()).toMatch(/design|verify|asset/i);
  });
});
