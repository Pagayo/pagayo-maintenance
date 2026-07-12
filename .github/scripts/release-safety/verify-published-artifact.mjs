#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { withTempDir, readPackageJson } from "./lib/tarball.mjs";
import { loadProfile } from "./lib/compare-contract.mjs";
import { inventoryDistFiles, requiredCssBundles, countFonts, countIllustrations } from "./lib/design-inventory.mjs";
import { normalizeExpectedSchemaSnapshot } from "./lib/schema-snapshot.mjs";

function parseArgs(argv) {
  const args = { profile: null, version: null, registryPackage: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--profile") args.profile = argv[++i];
    else if (arg === "--version") args.version = argv[++i];
    else if (arg === "--package") args.registryPackage = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.profile || !args.version) {
    throw new Error(
      "Usage: verify-published-artifact.mjs --profile <config|schema|design> --version <semver> [--package @pagayo/name]",
    );
  }
  return args;
}

async function smokeConfig(packageRoot, profile, pkg) {
  const policyEntry = pkg.exports["./policy"];
  const policy = await import(pathToFileURL(join(packageRoot, policyEntry.import)).href);
  for (const feature of profile.requiredPolicyFeatures ?? []) {
    if (!policy.FEATURES?.includes(feature)) throw new Error(`Published artifact missing policy feature: ${feature}`);
  }
  for (const exportName of profile.requiredPolicyExports ?? []) {
    if (!(exportName in policy)) throw new Error(`Published artifact missing policy export: ${exportName}`);
  }
  for (const subpath of Object.keys(pkg.exports)) {
    const entry = pkg.exports[subpath];
    if (entry?.import) await import(pathToFileURL(join(packageRoot, entry.import)).href);
  }
}

function smokeSchema(packageRoot) {
  normalizeExpectedSchemaSnapshot(packageRoot);
  for (const domain of ["platform", "tenant", "api"]) {
    readFileSync(join(packageRoot, "migrations", domain, "expected-schema.json"), "utf8");
  }
}

function smokeDesign(packageRoot, profile) {
  const inventory = inventoryDistFiles(packageRoot);
  for (const bundle of requiredCssBundles()) {
    if (!inventory.includes(bundle)) throw new Error(`Published design artifact missing ${bundle}`);
  }
  if (countFonts(packageRoot) < (profile.minFontCount ?? 0)) {
    throw new Error("Published design artifact missing required fonts");
  }
  if (countIllustrations(packageRoot) < (profile.minIllustrationCount ?? 0)) {
    throw new Error("Published design artifact missing required illustrations");
  }
}

const args = parseArgs(process.argv);
const profile = loadProfile(args.profile);
const packageName = args.registryPackage ?? profile.package;

await withTempDir(async (workDir) => {
  const installDir = join(workDir, "install");
  execFileSync("npm", ["init", "-y"], { cwd: installDir, stdio: "pipe" });
  execFileSync("npm", ["install", `${packageName}@${args.version}`], {
    cwd: installDir,
    stdio: "inherit",
    env: process.env,
  });

  const installedRoot = join(installDir, "node_modules", packageName);
  const pkg = readPackageJson(installedRoot);

  if (args.profile === "config") await smokeConfig(installedRoot, profile, pkg);
  else if (args.profile === "schema") smokeSchema(installedRoot);
  else if (args.profile === "design") smokeDesign(installedRoot, profile);
  else throw new Error(`Unsupported profile: ${args.profile}`);

  console.log(`Published artifact verified: ${packageName}@${args.version}`);
});
