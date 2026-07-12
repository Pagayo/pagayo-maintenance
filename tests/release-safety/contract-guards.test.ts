import { describe, expect, it } from "vitest";
import { assertSuperset, compareExportMaps } from "../../.github/scripts/release-safety/lib/compare-contract.mjs";
import { requiredCssBundles } from "../../.github/scripts/release-safety/lib/design-inventory.mjs";

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

describe("release-safety design inventory", () => {
  it("requires 5 themes x 5 contexts css bundles", () => {
    expect(requiredCssBundles()).toHaveLength(25);
    expect(requiredCssBundles()[0]).toBe("dist/aqua/admin.css");
  });
});
