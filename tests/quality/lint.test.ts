/**
 * Code Quality Tests - ESLint
 *
 * Runt ESLint op alle relevante Pagayo repos om code quality issues te vinden
 * VOORDAT er gecommit wordt naar GitHub.
 *
 * Hard gate: 0 errors EN 0 warnings.
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";

const WORKSPACE_ROOT = "/Users/sjoerdoverdiep/my-vscode-workspace";

// Repos met ESLint configuratie
const REPOS_WITH_LINT = [
  "pagayo-storefront",
  "pagayo-api-stack",
  "pagayo-edge",
  "pagayo-workflows",
  "pagayo-config",
  "pagayo-schema",
  "pagayo-marketing",
];

function log(repo: string, status: "PASS" | "FAIL" | "SKIP", message: string) {
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "○";
  console.log(`  [QUALITY] ${icon} ${repo}: ${message}`);
}

describe("Code Quality - ESLint", () => {
  for (const repo of REPOS_WITH_LINT) {
    it(
      `${repo} passes ESLint (0 errors, 0 warnings)`,
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
          const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

          if (!packageJson.scripts?.lint) {
            log(repo, "SKIP", "geen lint script");
            return;
          }

          // Run ESLint strikt: warnings moeten ook failen
          execSync(`cd ${repoPath} && npm run lint -- --max-warnings=0 2>&1`, {
            encoding: "utf-8",
            timeout: 120000,
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          });

          log(repo, "PASS", "geen lint errors/warnings");
          expect(true).toBe(true);
        } catch (error) {
          // execSync throws als exit code != 0
          const output =
            (error as { stdout?: string; stderr?: string }).stdout ||
            (error as { message?: string }).message ||
            "";

          // Parse error output
          const errorMatch = output.match(/(\d+)\s+errors?/);
          const warningMatch = output.match(/(\d+)\s+warnings?/);
          const errorCount = errorMatch ? errorMatch[1] : "0";
          const warningCount = warningMatch ? warningMatch[1] : "0";

          log(
            repo,
            "FAIL",
            `${errorCount} errors, ${warningCount} warnings (strict lint gate)`,
          );

          // Toon laatste 1000 chars voor context
          const snippet = output.slice(-1000);
          expect.fail(
            `ESLint failed for ${repo} (${errorCount} errors, ${warningCount} warnings):\n${snippet}`,
          );
        }
      },

    ); // 3 min timeout per repo
  }
});
