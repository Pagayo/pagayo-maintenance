import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const THEMES = ["revolutionary", "classic", "fresh", "aqua", "portal"];
const CONTEXTS = ["admin", "webshop", "pos", "qr", "start"];

export function requiredCssBundles() {
  const bundles = [];
  for (const theme of THEMES) {
    for (const context of CONTEXTS) {
      bundles.push(`dist/${theme}/${context}.css`);
    }
  }
  return bundles.sort();
}

export function inventoryDistFiles(packageRoot) {
  const distRoot = join(packageRoot, "dist");
  if (!existsSync(distRoot)) return [];
  return execFileSync("find", [distRoot, "-type", "f"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .map((p) => p.slice(packageRoot.length + 1))
    .sort();
}

export function countIllustrations(packageRoot) {
  const dir = join(packageRoot, "dist/assets/block-illustrations");
  if (!existsSync(dir)) return 0;
  return execFileSync("find", [dir, "-maxdepth", "1", "-name", "*.svg", "-type", "f"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean).length;
}

export function countFonts(packageRoot) {
  const dir = join(packageRoot, "dist/assets/fonts");
  if (!existsSync(dir)) return 0;
  return execFileSync("find", [dir, "-maxdepth", "1", "-name", "*.woff2", "-type", "f"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean).length;
}
