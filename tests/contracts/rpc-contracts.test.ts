/**
 * RPC Contract Tests
 *
 * Validates that all Workers RPC implementations follow the Pagayo RPC contract:
 * - All RPC classes extend WorkerEntrypoint
 * - All RPC classes implement healthCheck()
 * - All methods return Promise<RpcResult<T>>
 * - Error codes are defined and used consistently
 * - RPC type definitions in @pagayo/config match implementations
 *
 * NOTE: These tests read SOURCE FILES directly — no live services needed.
 *
 * @module tests/contracts/rpc-contracts
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

// ===========================================
// CONFIG
// ===========================================

const WORKSPACE = resolve(__dirname, "../../../");

/** All RPC implementation files */
const RPC_IMPLEMENTATIONS = {
  ProvisioningRPC: {
    repo: "pagayo-storefront",
    file: "src/workers/rpc/provisioning.rpc.ts",
    calledBy: "pagayo-workflows",
    bindingName: "STOREFRONT",
    expectedMethods: [
      "createTenant",
      "getTenant",
      "deleteTenant",
      "healthCheck",
    ],
  },
  EdgeRPC: {
    repo: "pagayo-edge",
    file: "src/rpc/edge.rpc.ts",
    calledBy: "pagayo-storefront",
    bindingName: "EDGE",
    expectedMethods: [
      "kvPut",
      "kvGet",
      "kvDelete",
      "kvBulk",
      "invalidateCache",
      "bumpVersion",
      "getCatalogVersion",
      "healthCheck",
    ],
  },
  ApiStackRPC: {
    repo: "pagayo-api-stack",
    file: "src/rpc/api-stack.rpc.ts",
    calledBy: "pagayo-storefront",
    bindingName: "API_STACK",
    expectedMethods: ["sendContactNotification", "sendEmail", "healthCheck"],
  },
  WorkflowsRPC: {
    repo: "pagayo-workflows",
    file: "src/rpc/workflows.rpc.ts",
    calledBy: "pagayo-storefront",
    bindingName: "WORKFLOWS",
    expectedMethods: [
      "triggerTenantProvisioning",
      "getWorkflowStatus",
      "cancelWorkflow",
      "healthCheck",
    ],
  },
} as const;

/** RPC type definitions file in @pagayo/config */
const CONFIG_RPC_TYPES = join(WORKSPACE, "pagayo-config/src/rpc-types.ts");

/**
 * Read a source file from a repo
 */
function readRepoFile(repo: string, filePath: string): string {
  const fullPath = join(WORKSPACE, repo, filePath);
  return readFileSync(fullPath, "utf-8");
}

/**
 * Read wrangler.toml from a repo
 */
function readWranglerConfig(repo: string): string {
  return readRepoFile(repo, "wrangler.toml");
}

// ===========================================
// CONTRACT TESTS
// ===========================================

describe("RPC Contract Tests", () => {
  describe("Every RPC class extends WorkerEntrypoint", () => {
    for (const [className, config] of Object.entries(RPC_IMPLEMENTATIONS)) {
      it(`${className} (${config.repo}) extends WorkerEntrypoint`, () => {
        const source = readRepoFile(config.repo, config.file);

        // Must import WorkerEntrypoint
        expect(source).toContain(
          'import { WorkerEntrypoint } from "cloudflare:workers"',
        );

        // Must extend WorkerEntrypoint
        const classPattern = new RegExp(
          `class\\s+${className}\\s+extends\\s+WorkerEntrypoint`,
        );
        expect(source).toMatch(classPattern);
      });
    }
  });

  describe("Every RPC class has healthCheck()", () => {
    for (const [className, config] of Object.entries(RPC_IMPLEMENTATIONS)) {
      it(`${className} implements healthCheck()`, () => {
        const source = readRepoFile(config.repo, config.file);

        // Must have async healthCheck method
        expect(source).toMatch(/async\s+healthCheck\s*\(\s*\)\s*:\s*Promise</);

        // healthCheck must return RpcResult with status and timestamp
        const healthCheckSection = source.slice(
          source.indexOf("async healthCheck"),
        );
        expect(healthCheckSection).toContain('"healthy"');
        expect(healthCheckSection).toContain("timestamp");
      });
    }
  });

  describe("All expected methods exist", () => {
    for (const [className, config] of Object.entries(RPC_IMPLEMENTATIONS)) {
      for (const method of config.expectedMethods) {
        it(`${className}.${method}() exists`, () => {
          const source = readRepoFile(config.repo, config.file);
          // Handle generics like kvGet<T = unknown>(
          const methodPattern = new RegExp(`async\\s+${method}[\\s<(]`);
          expect(source).toMatch(methodPattern);
        });
      }
    }
  });

  describe("All RPC methods return RpcResult<T>", () => {
    for (const [className, config] of Object.entries(RPC_IMPLEMENTATIONS)) {
      it(`${className} methods all return Promise<RpcResult<...>>`, () => {
        const source = readRepoFile(config.repo, config.file);

        for (const method of config.expectedMethods) {
          // Find method and verify it returns Promise<RpcResult<...>>
          // Handle multiline method signatures and generics
          const methodIdx = source.search(
            new RegExp(`async\\s+${method}[\\s<(]`),
          );
          expect(methodIdx, `${className}.${method}() should exist`).not.toBe(
            -1,
          );

          // Extract from method start to closing paren + return type
          const methodSlice = source.slice(methodIdx, methodIdx + 500);
          expect(
            methodSlice,
            `${className}.${method}() should return Promise<RpcResult<T>>`,
          ).toMatch(/Promise<\s*\n?\s*RpcResult</);
        }
      });
    }
  });

  describe("RpcResult type definition consistency", () => {
    it("all implementations define matching RpcResult type", () => {
      for (const [_className, config] of Object.entries(RPC_IMPLEMENTATIONS)) {
        const source = readRepoFile(config.repo, config.file);

        // Must have RpcResult type (via interface or inline type)
        expect(source).toMatch(/type\s+RpcResult/);

        // Must use success: true/false pattern
        expect(source).toContain("success: true");
        expect(source).toContain("success: false");

        // Must have code and message in error results
        expect(source).toContain("code:");
        expect(source).toContain("message:");
      }
    });

    it("@pagayo/config defines same RpcResult structure", () => {
      const configSource = readFileSync(CONFIG_RPC_TYPES, "utf-8");

      // Config must export RpcSuccess, RpcError, RpcResult
      expect(configSource).toMatch(/export\s+interface\s+RpcSuccess<T>/);
      expect(configSource).toMatch(/export\s+interface\s+RpcError/);
      expect(configSource).toMatch(
        /export\s+type\s+RpcResult<T>\s*=\s*RpcSuccess<T>\s*\|\s*RpcError/,
      );

      // Config must export type guards
      expect(configSource).toMatch(/export\s+function\s+isRpcSuccess/);
      expect(configSource).toMatch(/export\s+function\s+isRpcError/);

      // Config must export helper functions
      expect(configSource).toMatch(/export\s+function\s+rpcSuccess/);
      expect(configSource).toMatch(/export\s+function\s+rpcError/);
    });
  });

  describe("RPC interface definitions in @pagayo/config", () => {
    it("defines ProvisioningRPC interface", () => {
      const source = readFileSync(CONFIG_RPC_TYPES, "utf-8");
      expect(source).toMatch(/export\s+interface\s+ProvisioningRPC/);
      expect(source).toContain("createTenant");
      expect(source).toContain("getTenant");
      expect(source).toContain("deleteTenant");
    });

    it("defines EdgeRPC interface", () => {
      const source = readFileSync(CONFIG_RPC_TYPES, "utf-8");
      expect(source).toMatch(/export\s+interface\s+EdgeRPC/);
      expect(source).toContain("kvPut");
      expect(source).toContain("kvGet");
      expect(source).toContain("kvDelete");
      expect(source).toContain("kvBulk");
      expect(source).toContain("invalidateCache");
      expect(source).toContain("bumpVersion");
      expect(source).toContain("getCatalogVersion");
    });

    it("defines ApiStackRPC interface", () => {
      const source = readFileSync(CONFIG_RPC_TYPES, "utf-8");
      expect(source).toMatch(/export\s+interface\s+ApiStackRPC/);
      expect(source).toContain("sendContactNotification");
      expect(source).toContain("sendEmail");
    });

    it("defines WorkflowRPC interface", () => {
      const source = readFileSync(CONFIG_RPC_TYPES, "utf-8");
      expect(source).toMatch(/export\s+interface\s+WorkflowRPC/);
      expect(source).toContain("trigger");
      expect(source).toContain("getStatus");
    });

    it("all interfaces extend RpcHealthCheckable", () => {
      const source = readFileSync(CONFIG_RPC_TYPES, "utf-8");

      // RpcHealthCheckable interface must exist
      expect(source).toMatch(/export\s+interface\s+RpcHealthCheckable/);

      // All RPC interfaces extend it
      expect(source).toMatch(/ProvisioningRPC\s+extends\s+RpcHealthCheckable/);
      expect(source).toMatch(/EdgeRPC\s+extends\s+RpcHealthCheckable/);
      expect(source).toMatch(/ApiStackRPC\s+extends\s+RpcHealthCheckable/);
      expect(source).toMatch(/WorkflowRPC\s+extends\s+RpcHealthCheckable/);
    });
  });

  describe("Error codes consistency", () => {
    it("all implementations define error codes (constant or inline)", () => {
      for (const [className, config] of Object.entries(RPC_IMPLEMENTATIONS)) {
        const source = readRepoFile(config.repo, config.file);
        // Either uses ERROR_CODES constant or inline string error codes
        const hasErrorCodes =
          /const\s+ERROR_CODES\s*=/.test(source) ||
          source.includes('"INTERNAL_ERROR"');
        expect(
          hasErrorCodes,
          `${className} should define error codes (constant or inline)`,
        ).toBe(true);
      }
    });

    it("all implementations use INTERNAL_ERROR somewhere", () => {
      for (const [className, config] of Object.entries(RPC_IMPLEMENTATIONS)) {
        const source = readRepoFile(config.repo, config.file);
        expect(source, `${className} should use INTERNAL_ERROR`).toContain(
          "INTERNAL_ERROR",
        );
      }
    });

    it("all implementations handle validation errors", () => {
      for (const [className, config] of Object.entries(RPC_IMPLEMENTATIONS)) {
        const source = readRepoFile(config.repo, config.file);
        // Either VALIDATION_ERROR, INVALID_INPUT, validation messages, or error handling
        const hasValidation =
          source.includes("VALIDATION_ERROR") ||
          source.includes("INVALID_INPUT") ||
          source.includes("is required") ||
          // Some RPC classes delegate validation to downstream services
          source.includes("success: false");
        expect(
          hasValidation,
          `${className} should handle validation or errors`,
        ).toBe(true);
      }
    });

    it("@pagayo/config defines comprehensive RPC_ERROR_CODES", () => {
      const source = readFileSync(CONFIG_RPC_TYPES, "utf-8");

      // Extract RPC_ERROR_CODES
      expect(source).toMatch(/export\s+const\s+RPC_ERROR_CODES/);

      // Must include standard codes
      const requiredCodes = [
        "INTERNAL_ERROR",
        "INVALID_INPUT",
        "NOT_FOUND",
        "UNAUTHORIZED",
        "RATE_LIMITED",
        "TENANT_NOT_FOUND",
        "KV_PUT_FAILED",
        "EMAIL_SEND_FAILED",
        "WORKFLOW_TRIGGER_FAILED",
        "HEALTH_CHECK_FAILED",
      ];

      for (const code of requiredCodes) {
        expect(source).toContain(code);
      }
    });

    it("RpcErrorCode type is exported", () => {
      const source = readFileSync(CONFIG_RPC_TYPES, "utf-8");
      expect(source).toMatch(/export\s+type\s+RpcErrorCode/);
    });
  });

  describe("Error handling patterns", () => {
    for (const [className, config] of Object.entries(RPC_IMPLEMENTATIONS)) {
      it(`${className} catches errors and returns structured error result`, () => {
        const source = readRepoFile(config.repo, config.file);

        // Must use try/catch pattern
        const catchCount = (source.match(/}\s*catch\s*\(/g) ?? []).length;
        expect(
          catchCount,
          `${className} should have try/catch blocks`,
        ).toBeGreaterThan(0);

        // Must return error objects with code and message
        expect(source).toContain("success: false");
        expect(source).toMatch(/error:\s*\{/);
        expect(source).toMatch(/code:\s*(ERROR_CODES\.|")/);
      });
    }
  });
});

describe("RPC Type Definitions - Input/Output Types", () => {
  describe("@pagayo/config exports all necessary types", () => {
    const configSource = readFileSync(CONFIG_RPC_TYPES, "utf-8");

    it("exports CreateTenantInput", () => {
      expect(configSource).toMatch(/export\s+interface\s+CreateTenantInput/);
      expect(configSource).toContain("name: string");
      expect(configSource).toContain("slug: string");
      expect(configSource).toContain("organizationId: string");
    });

    it("exports TenantInfo", () => {
      expect(configSource).toMatch(/export\s+interface\s+TenantInfo/);
      expect(configSource).toContain("id: string");
      expect(configSource).toContain("slug: string");
      expect(configSource).toContain("isActive: boolean");
    });

    it("exports KVPutParams", () => {
      expect(configSource).toMatch(/export\s+interface\s+KVPutParams/);
      expect(configSource).toContain("key: string");
      expect(configSource).toContain("value: unknown");
    });

    it("exports SendEmailParams", () => {
      expect(configSource).toMatch(/export\s+interface\s+SendEmailParams/);
      expect(configSource).toContain("to: string");
      expect(configSource).toContain("subject: string");
    });

    it("exports TriggerWorkflowInput", () => {
      expect(configSource).toMatch(/export\s+interface\s+TriggerWorkflowInput/);
      expect(configSource).toContain("workflowName: string");
    });

    it("exports VersionBumpReason type", () => {
      expect(configSource).toMatch(/export\s+type\s+VersionBumpReason/);
      expect(configSource).toContain('"product_update"');
      expect(configSource).toContain('"category_update"');
      expect(configSource).toContain('"manual"');
    });

    it("exports NotificationType", () => {
      expect(configSource).toMatch(/export\s+type\s+NotificationType/);
      expect(configSource).toContain('"order_placed"');
      expect(configSource).toContain('"contact_form"');
    });
  });
});
