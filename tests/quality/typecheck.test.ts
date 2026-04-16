/**
 * Code Quality Tests - TypeScript Type Checking
 *
 * Runt tsc --noEmit op alle Pagayo repos om type errors te vinden
 * VOORDAT er gecommit wordt naar GitHub.
 *
 * Dit voorkomt dat CI faalt na een push.
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { existsSync } from "fs";

const WORKSPACE_ROOT = "/Users/sjoerdoverdiep/my-vscode-workspace";

// Repos met TypeScript configuratie
const REPOS_WITH_TYPESCRIPT = [
  "pagayo-storefront",
  "pagayo-api-stack",
  "pagayo-edge",
  "pagayo-workflows",
  "pagayo-config",
  "pagayo-schema",
];

function log(repo: string, status: "PASS" | "FAIL" | "SKIP", message: string) {
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "○";
  console.log(`  [QUALITY] ${icon} ${repo}: ${message}`);
}

describe("Code Quality - TypeScript", () => {
  for (const repo of REPOS_WITH_TYPESCRIPT) {
    it(
      `${repo} passes TypeScript check (0 errors)`,
      { timeout: 240000 },
      async () => {
        const repoPath = `${WORKSPACE_ROOT}/${repo}`;

        // Check of repo bestaat
        if (!existsSync(repoPath)) {
          log(repo, "SKIP", "repo niet gevonden");
          return;
        }

        // Check of tsconfig.json bestaat
        const tsconfigPath = `${repoPath}/tsconfig.json`;
        if (!existsSync(tsconfigPath)) {
          log(repo, "SKIP", "geen tsconfig.json");
          return;
        }

        try {
          // Run TypeScript check (tsc --noEmit)
          execSync(`cd ${repoPath} && npx tsc --noEmit 2>&1`, {
            encoding: "utf-8",
            timeout: 180000, // 3 min
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          });

          log(repo, "PASS", "geen type errors");
          expect(true).toBe(true);
        } catch (error) {
          // execSync throws als exit code != 0
          const output =
            (error as { stdout?: string; stderr?: string }).stdout ||
            (error as { message?: string }).message ||
            "";

          // Count errors
          const errorLines = output
            .split("\n")
            .filter((line) => line.includes("error TS"));
          const errorCount = errorLines.length;

          log(repo, "FAIL", `${errorCount} TypeScript errors`);

          // Toon eerste 5 errors voor context
          const firstErrors = errorLines.slice(0, 5).join("\n");
          expect.fail(
            `TypeScript check failed for ${repo} (${errorCount} errors):\n${firstErrors}`,
          );
        }
      },

    ); // 4 min timeout per repo
  }
});
