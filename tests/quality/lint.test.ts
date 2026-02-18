/**
 * Code Quality Tests - ESLint
 *
 * Runt ESLint op alle Pagayo repos om code quality issues te vinden
 * VOORDAT er gecommit wordt naar GitHub.
 *
 * Dit voorkomt dat CI faalt na een push.
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { existsSync } from "fs";

const WORKSPACE_ROOT = "/Users/sjoerdoverdiep/my-vscode-workspace";

// Repos met ESLint configuratie
const REPOS_WITH_LINT = [
  "pagayo-beheer",
  "pagayo-storefront",
  "pagayo-api-stack",
  "pagayo-edge",
  "pagayo-workflows",
  "pagayo-config",
  "pagayo-marketing",
];

function log(repo: string, status: "PASS" | "FAIL" | "SKIP", message: string) {
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "○";
  console.log(`  [QUALITY] ${icon} ${repo}: ${message}`);
}

describe("Code Quality - ESLint", () => {
  for (const repo of REPOS_WITH_LINT) {
    it(
      `${repo} passes ESLint (0 errors)`,
      { timeout: 180000 },
      async () => {
        const repoPath = `${WORKSPACE_ROOT}/${repo}`;

        // Check of repo bestaat
        if (!existsSync(repoPath)) {
          log(repo, "SKIP", "repo niet gevonden");
          return;
        }

        // Check of package.json lint script heeft
        const packageJsonPath = `${repoPath}/package.json`;
        if (!existsSync(packageJsonPath)) {
          log(repo, "SKIP", "geen package.json");
          return;
        }

        try {
          const packageJson = JSON.parse(
            execSync(`cat ${packageJsonPath}`, { encoding: "utf-8" }),
          );

          if (!packageJson.scripts?.lint) {
            log(repo, "SKIP", "geen lint script");
            return;
          }

          // Run ESLint
          const result = execSync(`cd ${repoPath} && npm run lint 2>&1`, {
            encoding: "utf-8",
            timeout: 120000,
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          });

          // Check voor errors (niet warnings)
          const hasErrors =
            result.includes("error") &&
            !result.includes("0 errors") &&
            result.includes("problems");

          if (hasErrors) {
            log(repo, "FAIL", "ESLint errors gevonden");
            // Extract error count
            const match = result.match(/(\d+) errors?/);
            const errorCount = match ? match[1] : "unknown";
            expect.fail(
              `ESLint found ${errorCount} errors in ${repo}:\n${result.slice(-500)}`,
            );
          } else {
            log(repo, "PASS", "geen errors");
            expect(true).toBe(true);
          }
        } catch (error) {
          // execSync throws als exit code != 0
          const output =
            (error as { stdout?: string; stderr?: string }).stdout ||
            (error as { message?: string }).message ||
            "";

          // Parse error output
          const match = output.match(/(\d+) errors?/);
          const errorCount = match ? match[1] : "?";

          log(repo, "FAIL", `${errorCount} ESLint errors`);

          // Toon laatste 1000 chars voor context
          const snippet = output.slice(-1000);
          expect.fail(
            `ESLint failed for ${repo} (${errorCount} errors):\n${snippet}`,
          );
        }
      },

    ); // 3 min timeout per repo
  }
});
