#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  withTempDir,
  extractTarball,
  packFromRegistry,
  readPackageJson,
  listFilesRecursive,
  resolveCandidateTarball,
} from "./lib/tarball.mjs";
import { loadProfile, compareExportMaps, compareFileSets, compareSchemaSnapshots } from "./lib/compare-contract.mjs";
import { verifyConfigNamedExportParity } from "./lib/named-exports.mjs";
import { listMigrationFiles, normalizeExpectedSchemaSnapshot } from "./lib/schema-snapshot.mjs";
import {
  inventoryDistFiles,
  requiredCssBundles,
  countFonts,
  countIllustrations,
} from "./lib/design-inventory.mjs";

function parseArgs(argv) {
  const args = { profile: null, candidate: null, allowBreaking: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--profile") args.profile = argv[++i];
    else if (arg === "--candidate-tarball") args.candidate = argv[++i];
    else if (arg === "--allow-breaking") args.allowBreaking = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.profile || !args.candidate) {
    throw new Error(
      "Usage: verify-contract-vs-latest.mjs --profile <config|schema|design> --candidate-tarball <path> [--allow-breaking]",
    );
  }
  return args;
}

async function loadPolicyModule(packageRoot, pkg) {
  const entry = pkg.exports?.["./policy"]?.import ?? pkg.exports?.["./policy"];
  if (!entry) throw new Error("Policy export missing from package");
  return import(pathToFileURL(join(packageRoot, entry)).href);
}

async function verifyConfigProfile(previousRoot, candidateRoot, profile, allowBreaking) {
  const previousPkg = readPackageJson(previousRoot);
  const candidatePkg = readPackageJson(candidateRoot);
  compareExportMaps(previousPkg, candidatePkg);

  const prevFiles = listFilesRecursive(previousRoot, "dist");
  const candFiles = listFilesRecursive(candidateRoot, "dist");
  compareFileSets(prevFiles, candFiles, "config dist files", allowBreaking);

  const candidatePolicy = await loadPolicyModule(candidateRoot, candidatePkg);
  for (const feature of profile.requiredPolicyFeatures ?? []) {
    if (!candidatePolicy.FEATURES?.includes(feature)) {
      throw new Error(`Required policy feature missing in candidate: ${feature}`);
    }
  }
  for (const exportName of profile.requiredPolicyExports ?? []) {
    if (!(exportName in candidatePolicy)) {
      throw new Error(`Required policy export missing in candidate: ${exportName}`);
    }
  }
  const policyTypes = readFileSync(join(candidateRoot, candidatePkg.exports["./policy"].types), "utf8");
  for (const typeName of profile.requiredPolicyTypeExports ?? []) {
    if (!policyTypes.includes(typeName)) {
      throw new Error(`Required policy type missing in candidate: ${typeName}`);
    }
  }

  if (!allowBreaking) {
    const previousPolicy = await loadPolicyModule(previousRoot, previousPkg);
    for (const exportName of profile.requiredPolicyExports ?? []) {
      if (exportName in previousPolicy && !(exportName in candidatePolicy)) {
        throw new Error(`Policy export removed: ${exportName}`);
      }
    }
  }

  await verifyConfigNamedExportParity(previousRoot, candidateRoot, allowBreaking);
}

async function verifySchemaProfile(previousRoot, candidateRoot, profile, allowBreaking) {
  const previousPkg = readPackageJson(previousRoot);
  const candidatePkg = readPackageJson(candidateRoot);
  compareExportMaps(previousPkg, candidatePkg);

  for (const domain of profile.migrationDomains ?? []) {
    const prevMigrations = listMigrationFiles(previousRoot, domain);
    const candMigrations = listMigrationFiles(candidateRoot, domain);
    compareFileSets(prevMigrations, candMigrations, `migrations/${domain}`, allowBreaking);
  }

  const prevSnapshot = normalizeExpectedSchemaSnapshot(previousRoot);
  const candSnapshot = normalizeExpectedSchemaSnapshot(candidateRoot);
  compareSchemaSnapshots(prevSnapshot, candSnapshot, allowBreaking);
}

async function verifyDesignProfile(previousRoot, candidateRoot, profile, allowBreaking) {
  const previousPkg = readPackageJson(previousRoot);
  const candidatePkg = readPackageJson(candidateRoot);
  compareExportMaps(previousPkg, candidatePkg);

  const prevInventory = inventoryDistFiles(previousRoot);
  const candInventory = inventoryDistFiles(candidateRoot);
  compareFileSets(prevInventory, candInventory, "design dist inventory", allowBreaking);

  for (const bundle of requiredCssBundles()) {
    if (!candInventory.includes(bundle)) {
      throw new Error(`Required CSS bundle missing in candidate: ${bundle}`);
    }
  }

  const prevFonts = countFonts(previousRoot);
  const candFonts = countFonts(candidateRoot);
  if (candFonts < Math.max(prevFonts, profile.minFontCount ?? 0)) {
    throw new Error(`Font asset regression: candidate has ${candFonts}, previous ${prevFonts}`);
  }

  const prevIllustrations = countIllustrations(previousRoot);
  const candIllustrations = countIllustrations(candidateRoot);
  if (candIllustrations < Math.max(prevIllustrations, profile.minIllustrationCount ?? 0)) {
    throw new Error(
      `Illustration asset regression: candidate has ${candIllustrations}, previous ${prevIllustrations}`,
    );
  }
}

const { profile: profileName, candidate, allowBreaking } = parseArgs(process.argv);
const profile = loadProfile(profileName);
const candidateTarball = resolveCandidateTarball(candidate);

await withTempDir(async (workDir) => {
  let previousRoot = null;
  try {
    const latestTarball = packFromRegistry(profile.package, "latest", join(workDir, "latest-pack"));
    previousRoot = extractTarball(latestTarball, join(workDir, "previous"));
  } catch (error) {
    const message = String(error?.stderr ?? error?.message ?? error);
    if (message.includes("404") || message.includes("E404") || message.includes("code E404")) {
      console.log(`No previous release for ${profile.package}@latest — skipping contract comparison.`);
      return;
    }
    throw error;
  }

  const candidateRoot = extractTarball(candidateTarball, join(workDir, "candidate"));

  if (profileName === "config") await verifyConfigProfile(previousRoot, candidateRoot, profile, allowBreaking);
  else if (profileName === "schema") await verifySchemaProfile(previousRoot, candidateRoot, profile, allowBreaking);
  else if (profileName === "design") await verifyDesignProfile(previousRoot, candidateRoot, profile, allowBreaking);
  else throw new Error(`Unsupported profile: ${profileName}`);

  console.log(`Contract verified: ${profile.package} candidate is a superset of @latest`);
});
