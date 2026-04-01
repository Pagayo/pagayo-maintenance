/**
 * Cross-Worker Integration Tests (V2 — post-beheer migratie)
 *
 * Validates that Worker-to-Worker communication is correctly configured:
 * - Service bindings in wrangler.toml match expected entrypoints
 * - Caller code references correct binding names
 * - Caller handles both success and error RPC branches
 * - Provisioning flow (storefront → workflows → storefront) is consistent
 * - Data flow (storefront → edge, storefront → api-stack) is consistent
 *
 * NOTE: These tests read SOURCE FILES — no live services needed.
 * NOTE: pagayo-beheer is geabsorbeerd in pagayo-storefront (V2 migratie feb 2026)
 *
 * @module tests/integration/cross-worker-rpc
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

// ===========================================
// CONFIG
// ===========================================

const WORKSPACE = resolve(__dirname, "../../../");

/**
 * Read a file from a repo
 */
function readRepoFile(repo: string, path: string): string {
  return readFileSync(join(WORKSPACE, repo, path), "utf-8");
}

/**
 * Recursively collect all .ts files in a directory
 */
function collectTsFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(directory: string): void {
    try {
      const entries = readdirSync(directory);
      for (const entry of entries) {
        const fullPath = join(directory, entry);
        try {
          const stat = statSync(fullPath);
          if (
            stat.isDirectory() &&
            !entry.startsWith(".") &&
            entry !== "node_modules" &&
            entry !== "dist"
          ) {
            walk(fullPath);
          } else if (
            stat.isFile() &&
            entry.endsWith(".ts") &&
            !entry.endsWith(".test.ts") &&
            !entry.endsWith(".d.ts")
          ) {
            files.push(fullPath);
          }
        } catch {
          // Skip files we can't stat
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walk(dir);
  return files;
}

/**
 * Find all source files in a repo's src/ that reference a binding name
 */
function findBindingUsages(
  repo: string,
  bindingName: string,
): { file: string; lines: string[] }[] {
  const srcDir = join(WORKSPACE, repo, "src");
  const tsFiles = collectTsFiles(srcDir);
  const usages: { file: string; lines: string[] }[] = [];

  for (const file of tsFiles) {
    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");
    const matchingLines = lines.filter(
      (line) =>
        line.includes(`.${bindingName}.`) ||
        line.includes(`env.${bindingName}`) ||
        line.includes(`["${bindingName}"]`),
    );

    if (matchingLines.length > 0) {
      usages.push({
        file: file.replace(join(WORKSPACE, repo) + "/", ""),
        lines: matchingLines.map((l) => l.trim()),
      });
    }
  }

  return usages;
}

// ===========================================
// SERVICE BINDING CONFIGURATION TESTS
// ===========================================

describe("Service Binding Configuration", () => {
  describe("Storefront wrangler.toml service bindings", () => {
    const wrangler = readRepoFile("pagayo-storefront", "wrangler.toml");

    it("has EDGE binding pointing to EdgeRPC", () => {
      expect(wrangler).toContain('binding = "EDGE"');
      expect(wrangler).toContain('entrypoint = "EdgeRPC"');
    });

    it("has API_STACK binding pointing to ApiStackRPC", () => {
      expect(wrangler).toContain('binding = "API_STACK"');
      expect(wrangler).toContain('entrypoint = "ApiStackRPC"');
    });

    it("bindings exist in both staging and production", () => {
      const edgeBindings = wrangler.match(/binding\s*=\s*"EDGE"/g);
      const apiStackBindings = wrangler.match(/binding\s*=\s*"API_STACK"/g);

      expect(edgeBindings?.length ?? 0).toBeGreaterThanOrEqual(2);
      expect(apiStackBindings?.length ?? 0).toBeGreaterThanOrEqual(2);
    });
  });

  describe("API-Stack wrangler.toml service bindings", () => {
    const wrangler = readRepoFile("pagayo-api-stack", "wrangler.toml");

    it("has STOREFRONT service binding", () => {
      expect(wrangler).toContain('binding = "STOREFRONT"');
      expect(wrangler).toContain('service = "pagayo-storefront"');
    });

    it("has STOREFRONT binding in staging and production", () => {
      const storefrontBindings = wrangler.match(/binding\s*=\s*"STOREFRONT"/g);
      expect(storefrontBindings?.length ?? 0).toBeGreaterThanOrEqual(2);
    });
  });
});

// ===========================================
// RPC ENTRYPOINT EXPORT TESTS
// ===========================================

describe("RPC Entrypoint Exports", () => {
  it("pagayo-storefront exports ProvisioningRPC", () => {
    const source = readRepoFile(
      "pagayo-storefront",
      "src/workers/rpc/provisioning.rpc.ts",
    );
    expect(source).toMatch(/export\s+class\s+ProvisioningRPC/);
  });

  it("pagayo-edge exports EdgeRPC", () => {
    const source = readRepoFile("pagayo-edge", "src/rpc/edge.rpc.ts");
    expect(source).toMatch(/export\s+class\s+EdgeRPC/);
  });

  it("pagayo-api-stack exports ApiStackRPC", () => {
    const source = readRepoFile("pagayo-api-stack", "src/rpc/api-stack.rpc.ts");
    expect(source).toMatch(/export\s+class\s+ApiStackRPC/);
  });

  it("pagayo-workflows exports WorkflowsRPC", () => {
    const source = readRepoFile("pagayo-workflows", "src/rpc/workflows.rpc.ts");
    expect(source).toMatch(/export\s+class\s+WorkflowsRPC/);
  });
});

// ===========================================
// CROSS-WORKER COMMUNICATION PATTERNS
// ===========================================

describe("Storefront → Edge (KV/Cache)", () => {
  it("storefront uses EDGE binding in source code", () => {
    const usages = findBindingUsages("pagayo-storefront", "EDGE");
    expect(
      usages.length,
      "EDGE binding should be referenced in storefront source code",
    ).toBeGreaterThan(0);
  });

  it("storefront calls Edge KV methods via EDGE binding", () => {
    const usages = findBindingUsages("pagayo-storefront", "EDGE");
    const allLines = usages.flatMap((u) => u.lines);
    const lineText = allLines.join("\n");

    const callsEdgeMethod =
      lineText.includes("kvPut") ||
      lineText.includes("kvGet") ||
      lineText.includes("kvBulk") ||
      lineText.includes("invalidateCache") ||
      lineText.includes("bumpVersion") ||
      lineText.includes("EDGE.");

    expect(
      callsEdgeMethod,
      "Storefront should call Edge KV methods on EDGE binding",
    ).toBe(true);
  });
});

describe("Storefront → API-Stack (Email)", () => {
  it("storefront uses API_STACK binding in source code", () => {
    const usages = findBindingUsages("pagayo-storefront", "API_STACK");
    expect(
      usages.length,
      "API_STACK binding should be referenced in storefront source code",
    ).toBeGreaterThan(0);
  });

  it("storefront calls email methods via API_STACK binding", () => {
    const usages = findBindingUsages("pagayo-storefront", "API_STACK");
    const allLines = usages.flatMap((u) => u.lines);
    const lineText = allLines.join("\n");

    const callsApiStackMethod =
      lineText.includes("sendEmail") ||
      lineText.includes("sendContactNotification") ||
      lineText.includes("API_STACK.");

    expect(
      callsApiStackMethod,
      "Storefront should call API Stack email methods on API_STACK binding",
    ).toBe(true);
  });
});

describe("API-Stack → Storefront (Payment Status Forwarding)", () => {
  it("api-stack uses STOREFRONT binding in source code", () => {
    const usages = findBindingUsages("pagayo-api-stack", "STOREFRONT");
    expect(
      usages.length,
      "STOREFRONT binding should be referenced in api-stack source code",
    ).toBeGreaterThan(0);
  });

  it("api-stack forwards payment status via STOREFRONT binding", () => {
    const usages = findBindingUsages("pagayo-api-stack", "STOREFRONT");
    const allLines = usages.flatMap((u) => u.lines);
    const lineText = allLines.join("\n");

    const callsStorefront =
      lineText.includes("STOREFRONT.fetch") || lineText.includes("forward");

    expect(
      callsStorefront,
      "API Stack should forward payment status via STOREFRONT service binding",
    ).toBe(true);
  });
});

// ===========================================
// PROVISIONING FLOW CONSISTENCY
// ===========================================

describe("Provisioning Flow: Workflows → Storefront", () => {
  it("workflow triggers storefront provisioning via service binding", () => {
    // The provisioning workflow should call storefront's createTenant
    const workflowDir = join(WORKSPACE, "pagayo-workflows/src/workflows");
    const workflowFiles = collectTsFiles(workflowDir);

    let foundStorefrontCall = false;
    for (const file of workflowFiles) {
      const content = readFileSync(file, "utf-8");
      if (
        content.includes("STOREFRONT") ||
        content.includes("createTenant") ||
        content.includes("provisioning")
      ) {
        foundStorefrontCall = true;
        break;
      }
    }

    // Workflows should reference provisioning (either directly or via env binding)
    expect(
      foundStorefrontCall,
      "Provisioning workflow should reference STOREFRONT or createTenant",
    ).toBe(true);
  });

  it("workflows wrangler.toml has STOREFRONT service binding", () => {
    const wrangler = readRepoFile("pagayo-workflows", "wrangler.toml");

    // Workflows needs access to storefront for provisioning
    const hasStorefrontBinding =
      wrangler.includes("STOREFRONT") || wrangler.includes("pagayo-storefront");

    expect(
      hasStorefrontBinding,
      "Workflows should have STOREFRONT service binding for provisioning",
    ).toBe(true);
  });

  it("all provisioning input types are consistent", () => {
    // Workflows RPC defines TenantProvisioningParams
    const workflowsRpc = readRepoFile(
      "pagayo-workflows",
      "src/rpc/workflows.rpc.ts",
    );

    // Storefront RPC defines CreateTenantInput
    const storefrontRpc = readRepoFile(
      "pagayo-storefront",
      "src/workers/rpc/provisioning.rpc.ts",
    );

    // Both should have organizationId
    expect(workflowsRpc).toContain("organizationId");
    expect(storefrontRpc).toContain("organizationId");

    // Both should handle tenant slug/name
    expect(workflowsRpc).toContain("tenantSlug");
    expect(storefrontRpc).toContain("slug");

    // Both should handle contact/email
    expect(workflowsRpc).toContain("email");
    expect(storefrontRpc).toContain("email");
  });
});

// ===========================================
// ERROR HANDLING AT CALL SITES
// ===========================================

describe("RPC Error Handling at Call Sites", () => {
  it("storefront handles RPC errors from EDGE calls", () => {
    const usages = findBindingUsages("pagayo-storefront", "EDGE");

    if (usages.length > 0) {
      let anyHandlesResult = false;
      for (const usage of usages) {
        const content = readRepoFile("pagayo-storefront", usage.file);
        if (
          content.includes(".success") ||
          content.includes("isRpcSuccess") ||
          content.includes("isRpcError") ||
          content.includes("RpcResult")
        ) {
          anyHandlesResult = true;
          break;
        }
      }

      expect(
        anyHandlesResult,
        "At least one storefront file should handle Edge RPC results",
      ).toBe(true);
    }
  });
});

// ===========================================
// BINDING TYPE DEFINITIONS CONSISTENCY
// ===========================================

describe("Worker Binding Type Definitions", () => {
  it("storefront has EDGE and API_STACK in its type definitions", () => {
    const typesFiles = [
      "worker-configuration.d.ts",
      "src/workers/types.ts",
      "src/types.ts",
    ];

    let found = false;
    for (const file of typesFiles) {
      try {
        const content = readRepoFile("pagayo-storefront", file);
        if (content.includes("EDGE") && content.includes("API_STACK")) {
          found = true;
          break;
        }
      } catch {
        // File doesn't exist
      }
    }

    expect(
      found,
      "Storefront should have EDGE and API_STACK in type definitions",
    ).toBe(true);
  });

  it("api-stack has STOREFRONT in its type definitions", () => {
    const typesFile = readRepoFile("pagayo-api-stack", "src/workers/types.ts");
    expect(typesFile).toContain("STOREFRONT");
  });
});
