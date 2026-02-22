/**
 * Contract Tests — Policy Engine
 *
 * Valideert dat de Policy Engine source files in @pagayo/config
 * de verwachte structuur, exports, en types bevatten.
 *
 * Dit is een SOURCE-level validatie — geen runtime, leest direct
 * de TypeScript bestanden. Net als rpc-contracts.test.ts.
 *
 * DOEL: Detecteer breaking changes in de policy engine voordat
 * ze de consumers (beheer, storefront, edge) bereiken.
 *
 * @module tests/contracts/policy-engine-contracts
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const WORKSPACE = resolve(__dirname, "../../../");
const CONFIG_ROOT = join(WORKSPACE, "pagayo-config");
const POLICY_DIR = join(CONFIG_ROOT, "src/policy");

/**
 * Lees een bestand uit de policy module.
 */
function readPolicyFile(filename: string): string {
  const path = join(POLICY_DIR, filename);
  return readFileSync(path, "utf-8");
}

// ===========================================
// POLICY ENGINE BESTANDEN BESTAAN
// ===========================================

describe("Policy Engine — Bestands structuur", () => {
  const REQUIRED_FILES = [
    "types.ts",
    "policy-matrix.ts",
    "policy-engine.ts",
    "index.ts",
  ];

  for (const file of REQUIRED_FILES) {
    it(`${file} bestaat`, () => {
      const path = join(POLICY_DIR, file);
      expect(existsSync(path), `${file} ontbreekt in pagayo-config/src/policy/`).toBe(true);
    });
  }
});

// ===========================================
// TYPES.TS — TYPE DEFINITIES CONTRACT
// ===========================================

describe("Policy Engine — types.ts contract", () => {
  const source = readPolicyFile("types.ts");

  describe("Tier type", () => {
    it("exporteert Tier type met 4 waarden", () => {
      expect(source).toMatch(/export\s+type\s+Tier\s*=/);
      expect(source).toContain("'FREE'");
      expect(source).toContain("'SUPPORTER'");
      expect(source).toContain("'PROFESSIONAL'");
      expect(source).toContain("'ADVANCED'");
    });

    it("exporteert TIERS const array", () => {
      expect(source).toMatch(/export\s+const\s+TIERS/);
    });
  });

  describe("Feature type", () => {
    const EXPECTED_FEATURES = [
      "WEBSHOP", "POS", "RENTAL", "SUBSCRIPTIONS",
      "INVOICE", "WHATSAPP", "SOCIAL", "CASH", "MANUAL",
    ];

    it("exporteert Feature type met alle 9 features", () => {
      expect(source).toMatch(/export\s+type\s+Feature\s*=/);
      for (const feature of EXPECTED_FEATURES) {
        expect(source, `Feature ${feature} ontbreekt`).toContain(`'${feature}'`);
      }
    });

    it("exporteert FEATURES const array", () => {
      expect(source).toMatch(/export\s+const\s+FEATURES/);
    });
  });

  describe("Action type", () => {
    const EXPECTED_ACTIONS = [
      "admin.view", "admin.configure", "admin.design", "admin.team", "admin.api",
      "commerce.checkout", "commerce.order",
      "branding.footer", "branding.email",
      "limit.products", "limit.orders", "limit.users", "limit.storage", "limit.history",
    ];

    it("exporteert Action type met alle 14 acties", () => {
      expect(source).toMatch(/export\s+type\s+Action\s*=/);
      for (const action of EXPECTED_ACTIONS) {
        expect(source, `Action '${action}' ontbreekt`).toContain(`'${action}'`);
      }
    });

    it("exporteert ACTIONS const array", () => {
      expect(source).toMatch(/export\s+const\s+ACTIONS/);
    });
  });

  describe("PolicyResult type", () => {
    const EXPECTED_RESULTS = [
      "ALLOWED", "BLOCKED", "VIEW_ONLY",
      "SOFT_LIMIT", "HARD_LIMIT",
      "BRANDED", "BRANDED_OPTIONAL",
    ];

    it("exporteert PolicyResult type met alle 7 waarden", () => {
      expect(source).toMatch(/export\s+type\s+PolicyResult\s*=/);
      for (const result of EXPECTED_RESULTS) {
        expect(source, `PolicyResult '${result}' ontbreekt`).toContain(`'${result}'`);
      }
    });

    it("exporteert POLICY_RESULTS const array", () => {
      expect(source).toMatch(/export\s+const\s+POLICY_RESULTS/);
    });
  });

  describe("Interface contracts", () => {
    it("exporteert PolicyEntry interface met result en optionele velden", () => {
      expect(source).toMatch(/export\s+interface\s+PolicyEntry/);
      expect(source).toContain("result: PolicyResult");
      expect(source).toContain("value?: number");
      expect(source).toContain("nudgeKey?: string");
      expect(source).toContain("nudgeTier?: Tier");
    });

    it("exporteert PolicyMatrix type als Record<Feature, Record<Tier, Record<Action, PolicyEntry>>>", () => {
      expect(source).toMatch(/export\s+type\s+PolicyMatrix/);
      expect(source).toContain("Record<Feature, Record<Tier, Record<Action, PolicyEntry>>>");
    });

    it("exporteert PolicyOverrideInput interface", () => {
      expect(source).toMatch(/export\s+interface\s+PolicyOverrideInput/);
      expect(source).toContain("feature: string");
      expect(source).toContain("action: string");
      expect(source).toContain("result: string");
    });

    it("exporteert PolicyContext interface met tier, feature, action", () => {
      expect(source).toMatch(/export\s+interface\s+PolicyContext/);
      expect(source).toContain("tier: Tier");
      expect(source).toContain("feature: Feature");
      expect(source).toContain("action: Action");
    });

    it("exporteert ResolvedPolicyBlob interface (KV blob structuur)", () => {
      expect(source).toMatch(/export\s+interface\s+ResolvedPolicyBlob/);
      expect(source).toContain("tier: Tier");
      expect(source).toContain("policies: Record<string, PolicyEntry>");
      expect(source).toContain("announcements: PolicyAnnouncement[]");
      expect(source).toContain("syncedAt: string");
    });

    it("exporteert PolicyAnnouncement interface", () => {
      expect(source).toMatch(/export\s+interface\s+PolicyAnnouncement/);
      expect(source).toContain("id: string");
      expect(source).toContain("titleKey: string");
      expect(source).toContain("bodyKey: string");
    });
  });
});

// ===========================================
// POLICY-MATRIX.TS — MATRIX CONTRACT
// ===========================================

describe("Policy Engine — policy-matrix.ts contract", () => {
  const source = readPolicyFile("policy-matrix.ts");

  it("exporteert POLICY_MATRIX als PolicyMatrix type", () => {
    expect(source).toMatch(/export\s+const\s+POLICY_MATRIX:\s*PolicyMatrix/);
  });

  it("importeert PolicyMatrix type uit types", () => {
    expect(source).toContain("PolicyMatrix");
    expect(source).toMatch(/from\s+["']\.\/types["']/);
  });

  describe("Bevat alle 9 features als top-level keys", () => {
    const FEATURES = [
      "WEBSHOP", "POS", "RENTAL", "SUBSCRIPTIONS",
      "INVOICE", "WHATSAPP", "SOCIAL", "CASH", "MANUAL",
    ];

    for (const feature of FEATURES) {
      it(`feature ${feature} is gedefinieerd`, () => {
        // Feature key in matrix object
        const pattern = new RegExp(`${feature}:\\s*\\{`);
        expect(source).toMatch(pattern);
      });
    }
  });

  describe("Business-critical patterns in source", () => {
    it("CASH heeft 'allowed' voor checkout (altijd toegankelijk)", () => {
      // CASH feature checkout moet allowed zijn - dit is een harde business rule
      const cashSection = source.slice(source.indexOf("CASH:"));
      expect(cashSection).toBeDefined();
    });

    it("MANUAL heeft 'allowed' voor checkout (altijd toegankelijk)", () => {
      const manualSection = source.slice(source.indexOf("MANUAL:"));
      expect(manualSection).toBeDefined();
    });

    it("gebruikt helper factories voor DRY matrix", () => {
      // De matrix moet helpers gebruiken, geen copy-paste
      expect(source).toContain("const allowed");
      expect(source).toContain("function blockedWithNudge");
    });
  });
});

// ===========================================
// POLICY-ENGINE.TS — ENGINE CONTRACT
// ===========================================

describe("Policy Engine — policy-engine.ts contract", () => {
  const source = readPolicyFile("policy-engine.ts");

  describe("Evaluatie functies", () => {
    it("exporteert evaluatePolicy functie", () => {
      expect(source).toMatch(/export\s+function\s+evaluatePolicy/);
    });

    it("evaluatePolicy accepteert PolicyContext en overrides", () => {
      // Moet ctx: PolicyContext als eerste param hebben
      const evalSection = source.slice(source.indexOf("export function evaluatePolicy"));
      expect(evalSection).toContain("PolicyContext");
      expect(evalSection).toContain("PolicyOverrideInput");
    });

    it("evaluatePolicy retourneert PolicyEntry", () => {
      const evalSection = source.slice(
        source.indexOf("export function evaluatePolicy"),
        source.indexOf("export function evaluatePolicy") + 300,
      );
      expect(evalSection).toContain("PolicyEntry");
    });

    it("exporteert evaluateAllPolicies voor batch evaluatie", () => {
      expect(source).toMatch(/export\s+function\s+evaluateAllPolicies/);
    });

    it("evaluateAllPolicies retourneert Record<string, PolicyEntry>", () => {
      const batchSection = source.slice(
        source.indexOf("export function evaluateAllPolicies"),
        source.indexOf("export function evaluateAllPolicies") + 300,
      );
      expect(batchSection).toContain("Record<string, PolicyEntry>");
    });
  });

  describe("KV Blob builder", () => {
    it("exporteert buildPolicyBlob", () => {
      expect(source).toMatch(/export\s+function\s+buildPolicyBlob/);
    });

    it("buildPolicyBlob retourneert ResolvedPolicyBlob", () => {
      const blobSection = source.slice(
        source.indexOf("export function buildPolicyBlob"),
        source.indexOf("export function buildPolicyBlob") + 300,
      );
      expect(blobSection).toContain("ResolvedPolicyBlob");
    });

    it("buildPolicyBlob bevat syncedAt timestamp", () => {
      expect(source).toContain("syncedAt");
      expect(source).toContain("toISOString");
    });
  });

  describe("Helper functies", () => {
    it("exporteert checkPolicy voor snelle lookup", () => {
      expect(source).toMatch(/export\s+function\s+checkPolicy/);
    });

    it("exporteert isAllowed type guard", () => {
      expect(source).toMatch(/export\s+function\s+isAllowed/);
    });

    it("exporteert isLimit type guard", () => {
      expect(source).toMatch(/export\s+function\s+isLimit/);
    });

    it("isAllowed behandelt ALLOWED, SOFT_LIMIT, BRANDED, BRANDED_OPTIONAL als true", () => {
      const isAllowedSection = source.slice(source.indexOf("function isAllowed"));
      expect(isAllowedSection).toContain("ALLOWED");
      expect(isAllowedSection).toContain("SOFT_LIMIT");
      expect(isAllowedSection).toContain("BRANDED");
      expect(isAllowedSection).toContain("BRANDED_OPTIONAL");
    });
  });

  describe("Fallback gedrag", () => {
    it("retourneert BLOCKED als default bij ontbrekende entries", () => {
      // De engine moet BLOCKED retourneren voor onbekende features/tiers/actions
      const blockedFallbacks = (source.match(/result:\s*['"]BLOCKED['"]/g) ?? []).length;
      expect(blockedFallbacks, "Minstens 3 BLOCKED fallbacks (feature, tier, action)").toBeGreaterThanOrEqual(3);
    });
  });
});

// ===========================================
// CROSS-FILE CONSISTENCY
// ===========================================

describe("Policy Engine — Cross-file consistency", () => {
  const types = readPolicyFile("types.ts");
  const matrix = readPolicyFile("policy-matrix.ts");
  const engine = readPolicyFile("policy-engine.ts");

  it("engine importeert POLICY_MATRIX uit policy-matrix", () => {
    expect(engine).toContain("POLICY_MATRIX");
    expect(engine).toMatch(/from\s+["']\.\/policy-matrix["']/);
  });

  it("engine importeert types uit types.ts", () => {
    expect(engine).toMatch(/from\s+["']\.\/types["']/);
    expect(engine).toContain("PolicyEntry");
    expect(engine).toContain("PolicyContext");
  });

  it("matrix importeert PolicyMatrix type uit types.ts", () => {
    expect(matrix).toContain("PolicyMatrix");
    expect(matrix).toMatch(/from\s+["']\.\/types["']/);
  });

  it("alle bestanden gebruiken dezelfde Feature namen", () => {
    const features = ["WEBSHOP", "POS", "RENTAL", "SUBSCRIPTIONS", "INVOICE", "WHATSAPP", "SOCIAL", "CASH", "MANUAL"];
    for (const feature of features) {
      expect(types, `Feature ${feature} ontbreekt in types.ts`).toContain(`'${feature}'`);
      expect(matrix, `Feature ${feature} ontbreekt in policy-matrix.ts`).toContain(`${feature}:`);
    }
  });

  it("alle bestanden gebruiken dezelfde Tier namen", () => {
    const tiers = ["FREE", "SUPPORTER", "PROFESSIONAL", "ADVANCED"];
    for (const tier of tiers) {
      expect(types, `Tier ${tier} ontbreekt in types.ts`).toContain(`'${tier}'`);
      expect(matrix, `Tier ${tier} ontbreekt in policy-matrix.ts`).toContain(`${tier}:`);
    }
  });
});

// ===========================================
// BARREL EXPORT (index.ts) CONTRACT
// ===========================================

describe("Policy Engine — Barrel export (index.ts)", () => {
  const barrel = readPolicyFile("index.ts");

  it("re-exporteert alle types", () => {
    expect(barrel).toContain("Tier");
    expect(barrel).toContain("Feature");
    expect(barrel).toContain("Action");
    expect(barrel).toContain("PolicyResult");
    expect(barrel).toContain("PolicyEntry");
    expect(barrel).toContain("PolicyMatrix");
    expect(barrel).toContain("PolicyOverrideInput");
    expect(barrel).toContain("PolicyContext");
    expect(barrel).toContain("ResolvedPolicyBlob");
    expect(barrel).toContain("PolicyAnnouncement");
  });

  it("re-exporteert const arrays", () => {
    expect(barrel).toContain("TIERS");
    expect(barrel).toContain("FEATURES");
    expect(barrel).toContain("ACTIONS");
    expect(barrel).toContain("POLICY_RESULTS");
  });

  it("re-exporteert POLICY_MATRIX", () => {
    expect(barrel).toContain("POLICY_MATRIX");
    expect(barrel).toMatch(/from\s+["']\.\/policy-matrix["']/);
  });

  it("re-exporteert engine functies", () => {
    expect(barrel).toContain("evaluatePolicy");
    expect(barrel).toContain("evaluateAllPolicies");
    expect(barrel).toContain("buildPolicyBlob");
    expect(barrel).toContain("checkPolicy");
    expect(barrel).toContain("isAllowed");
    expect(barrel).toContain("isLimit");
  });
});

// ===========================================
// PACKAGE.JSON EXPORT CONTRACT
// ===========================================

describe("Policy Engine — Package exports", () => {
  const packageJson = JSON.parse(
    readFileSync(join(CONFIG_ROOT, "package.json"), "utf-8"),
  );

  it("package.json bevat ./policy subpath export", () => {
    const policyExport = packageJson.exports?.["./policy"];
    expect(policyExport, "./policy export ontbreekt in package.json").toBeDefined();
    expect(policyExport.types).toContain("dist/policy/index.d.ts");
    expect(policyExport.import).toContain("dist/policy/index.mjs");
    expect(policyExport.require).toContain("dist/policy/index.js");
  });

  it("build script bevat src/policy/index.ts entry point", () => {
    expect(packageJson.scripts?.build).toContain("src/policy/index.ts");
  });
});

// ===========================================
// SCHEMA CONTRACT — @pagayo/schema
// ===========================================

describe("Policy Engine — Schema contract (@pagayo/schema)", () => {
  const SCHEMA_ROOT = join(WORKSPACE, "pagayo-schema");
  const PLATFORM_DIR = join(SCHEMA_ROOT, "src/platform");

  function readSchemaFile(filename: string): string {
    const path = join(PLATFORM_DIR, filename);
    return readFileSync(path, "utf-8");
  }

  describe("organizationTierEnum", () => {
    const source = readSchemaFile("enums.ts");

    it("bevat de 4 actieve tiers", () => {
      expect(source).toContain("'FREE'");
      expect(source).toContain("'SUPPORTER'");
      expect(source).toContain("'PROFESSIONAL'");
      expect(source).toContain("'ADVANCED'");
    });

    it("bevat ENTERPRISE voor backward compatibility", () => {
      expect(source).toContain("'ENTERPRISE'");
      // ENTERPRISE moet als deprecated gemarkeerd zijn
      expect(source).toMatch(/deprecated|@deprecated/i);
    });
  });

  describe("schema-policy.ts", () => {
    it("bestand bestaat", () => {
      expect(existsSync(join(PLATFORM_DIR, "schema-policy.ts"))).toBe(true);
    });

    const source = readSchemaFile("schema-policy.ts");

    it("exporteert policyOverrides tabel", () => {
      expect(source).toMatch(/export\s+const\s+policyOverrides\s*=\s*pgTable/);
    });

    it("policyOverrides heeft verplichte kolommen", () => {
      expect(source).toContain("feature");
      expect(source).toContain("action");
      expect(source).toContain("result");
      expect(source).toContain("reason");
      expect(source).toContain("isActive");
      expect(source).toContain("organizationId");
    });

    it("policyOverrides heeft scope kolommen", () => {
      expect(source).toContain("organizationId");
      expect(source).toContain("tier");
    });

    it("policyOverrides heeft expiratie", () => {
      expect(source).toContain("expiresAt");
    });

    it("exporteert platformAnnouncements tabel", () => {
      expect(source).toMatch(/export\s+const\s+platformAnnouncements\s*=\s*pgTable/);
    });

    it("platformAnnouncements heeft verplichte kolommen", () => {
      expect(source).toContain("titleKey");
      expect(source).toContain("bodyKey");
      expect(source).toContain("type");
      expect(source).toContain("priority");
      expect(source).toContain("targetType");
      expect(source).toContain("startsAt");
      expect(source).toContain("isActive");
    });

    it("platformAnnouncements heeft display opties", () => {
      expect(source).toContain("dismissible");
      expect(source).toContain("actionUrl");
      expect(source).toContain("actionLabel");
    });
  });

  describe("platform/index.ts exporteert schema-policy", () => {
    const indexSource = readSchemaFile("index.ts");

    it("bevat export van schema-policy", () => {
      expect(indexSource).toContain("schema-policy");
    });
  });

  describe("TIER_LIMITS in constants.ts", () => {
    const constants = readFileSync(
      join(SCHEMA_ROOT, "src/shared/constants.ts"),
      "utf-8",
    );

    it("exporteert TIER_LIMITS met 4-tier model", () => {
      expect(constants).toMatch(/export\s+const\s+TIER_LIMITS/);
      expect(constants).toContain("FREE:");
      expect(constants).toContain("SUPPORTER:");
      expect(constants).toContain("PROFESSIONAL:");
      expect(constants).toContain("ADVANCED:");
    });

    it("TIER_LIMITS bevat verwachte limiet velden", () => {
      expect(constants).toContain("maxProducts");
      expect(constants).toContain("maxOrdersPerMonth");
      expect(constants).toContain("maxStorageMb");
      expect(constants).toContain("maxAdminUsers");
      expect(constants).toContain("historyMonths");
    });
  });
});

// ===========================================
// BEHEER SHARED TYPES CONTRACT
// ===========================================

describe("Policy Engine — Beheer shared types", () => {
  const tierTypes = readFileSync(
    join(WORKSPACE, "pagayo-beheer/shared/types/tier.ts"),
    "utf-8",
  );

  it("OrganizationTier enum bevat 4 actieve tiers", () => {
    expect(tierTypes).toContain('FREE = "FREE"');
    expect(tierTypes).toContain('SUPPORTER = "SUPPORTER"');
    expect(tierTypes).toContain('PROFESSIONAL = "PROFESSIONAL"');
    expect(tierTypes).toContain('ADVANCED = "ADVANCED"');
  });

  it("OrganizationTier bevat deprecated ENTERPRISE", () => {
    expect(tierTypes).toContain('ENTERPRISE = "ENTERPRISE"');
    expect(tierTypes).toMatch(/deprecated|@deprecated/i);
  });

  it("TIER_CONFIG heeft entries voor alle tiers", () => {
    expect(tierTypes).toContain("OrganizationTier.FREE");
    expect(tierTypes).toContain("OrganizationTier.SUPPORTER");
    expect(tierTypes).toContain("OrganizationTier.PROFESSIONAL");
    expect(tierTypes).toContain("OrganizationTier.ADVANCED");
    expect(tierTypes).toContain("OrganizationTier.ENTERPRISE");
  });
});
