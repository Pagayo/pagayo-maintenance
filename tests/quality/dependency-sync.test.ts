/**
 * Dependency Sync Tests
 *
 * Controleert dat kritieke shared dependencies dezelfde versie-spec
 * hebben in ALLE Pagayo repos. Voorkomt drift na individuele
 * Dependabot updates of handmatige bumps.
 *
 * Draai: npm run test:quality:deps
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";

const WORKSPACE_ROOT = "/Users/sjoerdoverdiep/my-vscode-workspace";

/**
 * Kritieke dependencies die EXACT dezelfde versie-spec moeten hebben
 * in alle repos die ze gebruiken.
 *
 * key = package naam
 * repos = welke repos deze dependency MOETEN hebben
 * field = devDependencies (default) of dependencies
 */
const SYNCED_DEPENDENCIES: Array<{
  package: string;
  repos: string[];
  field: "devDependencies" | "dependencies";
}> = [
  {
    package: "wrangler",
    repos: [
      "pagayo-storefront",
      "pagayo-api-stack",
      "pagayo-edge",
      "pagayo-workflows",
      "pagayo-marketing",
    ],
    field: "devDependencies",
  },
  {
    package: "typescript",
    repos: [
      "pagayo-storefront",
      "pagayo-api-stack",
      "pagayo-edge",
      "pagayo-workflows",
      "pagayo-config",
    ],
    field: "devDependencies",
  },
  {
    // NOTE: pagayo-workflows AND pagayo-edge excluded - need vitest ~3.2.x for
    // @cloudflare/vitest-pool-workers compatibility (doesn't support 4.x)
    package: "vitest",
    repos: [
      "pagayo-storefront",
      "pagayo-api-stack",
      // "pagayo-edge",       // Uses ~3.2.4 for Cloudflare Workers pool
      // "pagayo-workflows",  // Uses ^3.2.0 for Cloudflare Workers pool
      "pagayo-config",
    ],
    field: "devDependencies",
  },
  {
    package: "drizzle-orm",
    repos: ["pagayo-storefront", "pagayo-api-stack", "pagayo-schema"],
    field: "dependencies",
  },
];

function log(dep: string, status: "PASS" | "FAIL" | "WARN", message: string) {
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "⚠";
  console.log(`  [SYNC] ${icon} ${dep}: ${message}`);
}

function getVersionSpec(
  repo: string,
  pkg: string,
  field: "devDependencies" | "dependencies",
): string | null {
  const pkgJsonPath = `${WORKSPACE_ROOT}/${repo}/package.json`;
  if (!existsSync(pkgJsonPath)) return null;

  try {
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    return (
      pkgJson[field]?.[pkg] ??
      pkgJson.dependencies?.[pkg] ??
      pkgJson.devDependencies?.[pkg] ??
      null
    );
  } catch {
    return null;
  }
}

describe("Dependency Sync — Kritieke packages moeten aligned zijn", () => {
  for (const dep of SYNCED_DEPENDENCIES) {
    it(`${dep.package} — zelfde versie-spec in alle repos`, () => {
      const versions: Array<{ repo: string; version: string }> = [];
      const missing: string[] = [];

      for (const repo of dep.repos) {
        const version = getVersionSpec(repo, dep.package, dep.field);
        if (version === null) {
          missing.push(repo);
        } else {
          versions.push({ repo, version });
        }
      }

      // Rapporteer ontbrekende repos
      if (missing.length > 0) {
        log(dep.package, "WARN", `niet gevonden in: ${missing.join(", ")}`);
      }

      // Minimaal 2 repos nodig om drift te detecteren
      if (versions.length < 2) {
        log(dep.package, "PASS", "minder dan 2 repos, geen sync check nodig");
        return;
      }

      // Controleer of alle versie-specs identiek zijn
      const uniqueVersions = [...new Set(versions.map((v) => v.version))];

      if (uniqueVersions.length === 1) {
        log(
          dep.package,
          "PASS",
          `alle ${versions.length} repos op ${uniqueVersions[0]}`,
        );
        expect(uniqueVersions).toHaveLength(1);
      } else {
        // Drift gedetecteerd — geef duidelijk overzicht
        const versionMap = versions
          .map((v) => `  ${v.repo}: ${v.version}`)
          .join("\n");

        log(
          dep.package,
          "FAIL",
          `${uniqueVersions.length} verschillende versies`,
        );

        expect.fail(
          `${dep.package} versie-drift gedetecteerd:\n${versionMap}\n\n` +
            `Fix: kies de hoogste versie en update alle repos.`,
        );
      }
    });
  }
});
