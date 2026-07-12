import { describe, expect, it } from "vitest";
import { assertSuperset, compareExportMaps } from "../../.github/scripts/release-safety/lib/compare-contract.mjs";
import { requiredCssBundles } from "../../.github/scripts/release-safety/lib/design-inventory.mjs";
import { compareNamedExportParity } from "../../.github/scripts/release-safety/lib/named-exports.mjs";

describe("release-safety compare-contract", () => {
  it("detects removed export keys", () => {
    expect(() => assertSuperset(new Set(["./policy", "./fonts"]), new Set(["./policy"]), "exports")).toThrow(
      /Contract regression/,
    );
  });

  it("allows superset export maps", () => {
    const previous = { exports: { ".": "./dist/index.js", "./policy": "./dist/policy.js" } };
    const candidate = {
      exports: { ".": "./dist/index.js", "./policy": "./dist/policy.js", "./fonts": "./dist/fonts.js" },
    };
    expect(() => compareExportMaps(previous, candidate)).not.toThrow();
  });
});

describe("release-safety named-export parity", () => {
  it("detects removed policy runtime named exports (1.15.22 class regression)", () => {
    const full = [
      "derivePrimaryQueue",
      "resolveCapabilitiesFromLegacy",
      "resolvePolicyLandingPath",
      "resolveNavigationFromCapabilities",
      "resolveCapabilityFirstRead",
      "FEATURES",
    ];
    const regressed = ["FEATURES"];
    expect(() =>
      compareNamedExportParity({
        subpath: "./policy",
        previousRuntime: full,
        candidateRuntime: regressed,
        previousDecl: { runtime: full, types: ["TenantCapabilitySet", "PrimaryQueue"] },
        candidateDecl: { runtime: ["FEATURES"], types: [] },
        allowBreaking: false,
      }),
    ).toThrow(/Named-export regression/);
  });
});

describe("release-safety design inventory", () => {
  it("requires 5 themes x 5 contexts css bundles", () => {
    expect(requiredCssBundles()).toHaveLength(25);
    expect(requiredCssBundles()[0]).toBe("dist/aqua/admin.css");
  });
});
