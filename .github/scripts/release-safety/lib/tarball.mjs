import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export function packFromRegistry(packageName, version, workDir) {
  execFileSync("npm", ["pack", `${packageName}@${version}`, "--pack-destination", workDir], {
    cwd: workDir,
    stdio: "pipe",
    env: process.env,
  });
  const files = execFileSync("ls", ["-1"], { cwd: workDir, encoding: "utf8" })
    .split("\n")
    .filter((f) => f.endsWith(".tgz"));
  if (files.length !== 1) {
    throw new Error(`Expected one tarball in ${workDir}, found: ${files.join(", ") || "none"}`);
  }
  return join(workDir, files[0]);
}

export function extractTarball(tarballPath, destDir) {
  execFileSync("tar", ["-xzf", tarballPath, "-C", destDir], { stdio: "pipe" });
  const entries = execFileSync("ls", ["-1"], { cwd: destDir, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const packageDir = entries.find((e) => e === "package") ?? entries[0];
  if (!packageDir) throw new Error(`No package directory in extracted tarball ${tarballPath}`);
  return join(destDir, packageDir);
}

export async function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "pagayo-release-safety-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function readPackageJson(packageRoot) {
  return JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
}

export function listFilesRecursive(root, prefix = "") {
  const results = [];
  if (!existsSync(root)) return results;
  for (const entry of execFileSync("find", [root, "-type", "f"], { encoding: "utf8" }).split("\n").filter(Boolean)) {
    const rel = entry.slice(root.length + 1);
    if (prefix && !rel.startsWith(prefix)) continue;
    results.push(rel);
  }
  return results.sort();
}

export function resolveCandidateTarball(candidatePath) {
  const resolved = resolve(candidatePath);
  if (!existsSync(resolved)) throw new Error(`Candidate tarball not found: ${resolved}`);
  return resolved;
}
