/**
 * Code Quality Tests - Unit Tests Orkestrator
 *
 * Draait `npm test` (of `npm run test:unit` voor workflows) in elke Pagayo repo
 * en rapporteert of alle unit tests slagen.
 *
 * Dit is de centrale plek waar de Tester agent alle unit tests
 * over het hele platform kan valideren met één commando.
 *
 * Net zoals lint.test.ts en typecheck.test.ts checkt dit bestand
 * de kwaliteit van ALLE repos vanuit pagayo-maintenance.
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { existsSync } from "fs";

const WORKSPACE_ROOT = "/Users/sjoerdoverdiep/my-vscode-workspace";

/**
 * Repos met unit tests en het commando om ze te draaien.
 *
 * De meeste repos gebruiken `npx vitest run`.
 * Workflows gebruikt `npm run test:unit` omdat de standaard vitest.config.ts
 * de Workers runtime vereist (service bindings), terwijl alle tests
 * pure unit tests met mocks zijn.
 */
const REPOS_WITH_TESTS: Array<{
  name: string;
  dir?: string; // directory naam als die afwijkt van name
  command: string;
  minTests: number;
}> = [
  {
    name: "pagayo-beheer",
    command: "npx vitest run",
    minTests: 600,
  },
  {
    name: "pagayo-storefront",
    command: "npx vitest run",
    minTests: 220,
  },
  {
    name: "pagayo-storefront (workers)",
    dir: "pagayo-storefront",
    command: "npx vitest run --config vitest.workers.config.ts",
    minTests: 850,
  },
  {
    name: "pagayo-api-stack",
    command: "npx vitest run",
    minTests: 400,
  },
  {
    name: "pagayo-edge",
    command: "npx vitest run",
    minTests: 300,
  },
  {
    name: "pagayo-workflows",
    command: "npm run test:unit",
    minTests: 850,
  },
  {
    name: "pagayo-config",
    command: "npx vitest run",
    minTests: 450,
  },
  {
    name: "pagayo-schema",
    command: "npx vitest run",
    minTests: 1,
  },
];

function log(
  repo: string,
  status: "PASS" | "FAIL" | "SKIP",
  message: string,
) {
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "○";
  console.log(`  [UNIT-TESTS] ${icon} ${repo}: ${message}`);
}

/**
 * Strip ANSI escape codes uit terminal output.
 * Vitest output bevat kleuren die regex matching breken.
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Parse vitest output om het aantal tests te extraheren.
 * Zoekt naar het patroon: "Tests  123 passed (123)" of "Tests  120 passed | 3 failed (123)"
 */
function parseTestCount(output: string): {
  passed: number;
  failed: number;
  total: number;
} {
  const clean = stripAnsi(output);

  // Match: "Tests  530 passed | 1 skipped (531)" of "Tests  228 passed (228)"
  const testsMatch = clean.match(
    /Tests\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+(?:failed|skipped))?\s*\((\d+)\)/,
  );

  if (testsMatch) {
    const passed = parseInt(testsMatch[1], 10);
    const failedOrSkipped = testsMatch[2]
      ? parseInt(testsMatch[2], 10)
      : 0;
    const total = parseInt(testsMatch[3], 10);
    return { passed, failed: total - passed - failedOrSkipped, total };
  }

  return { passed: 0, failed: 0, total: 0 };
}

describe("Code Quality - Unit Tests (alle repos)", () => {
  for (const repo of REPOS_WITH_TESTS) {
    it(
      `${repo.name} passes all unit tests (min ${repo.minTests})`,
      { timeout: 300000 },
      async () => {
        const repoPath = `${WORKSPACE_ROOT}/${repo.dir ?? repo.name}`;

        // Check of repo bestaat
        if (!existsSync(repoPath)) {
          log(repo.name, "SKIP", "repo niet gevonden");
          return;
        }

        // Check of package.json bestaat
        if (!existsSync(`${repoPath}/package.json`)) {
          log(repo.name, "SKIP", "geen package.json");
          return;
        }

        try {
          const output = execSync(
            `cd ${repoPath} && NO_COLOR=1 ${repo.command} 2>&1`,
            {
              encoding: "utf-8",
              timeout: 240000, // 4 min per repo
              maxBuffer: 10 * 1024 * 1024,
            },
          );

          const { passed, failed, total } = parseTestCount(output);

          if (failed > 0) {
            log(
              repo.name,
              "FAIL",
              `${failed}/${total} tests gefaald`,
            );
            expect.fail(
              `${repo.name}: ${failed} tests gefaald van ${total}.\nOutput:\n${output.slice(-1000)}`,
            );
          }

          if (total < repo.minTests) {
            log(
              repo.name,
              "FAIL",
              `slechts ${total} tests (minimum: ${repo.minTests})`,
            );
            expect(total).toBeGreaterThanOrEqual(repo.minTests);
          }

          log(repo.name, "PASS", `${passed}/${total} tests geslaagd`);
          expect(passed).toBeGreaterThanOrEqual(repo.minTests);
        } catch (error) {
          const output =
            (error as { stdout?: string; stderr?: string }).stdout ||
            (error as { stderr?: string }).stderr ||
            (error as { message?: string }).message ||
            "";

          // Check of het een test failure is of een runtime error
          const { passed, failed, total } = parseTestCount(output);

          if (total > 0 && failed > 0) {
            log(
              repo.name,
              "FAIL",
              `${failed}/${total} tests gefaald`,
            );
            expect.fail(
              `${repo.name}: ${failed}/${total} tests gefaald.\nLaatste output:\n${output.slice(-1000)}`,
            );
          } else {
            log(repo.name, "FAIL", "tests konden niet draaien");
            expect.fail(
              `${repo.name}: tests konden niet draaien.\nError:\n${output.slice(-1000)}`,
            );
          }
        }
      },
    );
  }
});
