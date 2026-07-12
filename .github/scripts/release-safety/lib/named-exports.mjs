import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Parse `export { ... }` blocks from a .d.ts file into runtime and type names.
 */
export function parseDeclarationNamedExports(dtsText) {
  const runtime = new Set();
  const types = new Set();

  for (const block of dtsText.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of block[1].split(",")) {
      const chunk = part.trim();
      if (!chunk) continue;
      const isType = /^type\s+/.test(chunk);
      const cleaned = chunk.replace(/^type\s+/, "").trim();
      const name = cleaned.split(/\s+as\s+/).pop()?.trim();
      if (!name) continue;
      (isType ? types : runtime).add(name);
    }
  }

  for (const match of dtsText.matchAll(/export\s+declare\s+(?:const|function|class|enum)\s+(\w+)/g)) {
    runtime.add(match[1]);
  }
  for (const match of dtsText.matchAll(/export\s+type\s+(\w+)/g)) {
    types.add(match[1]);
  }

  return {
    runtime: [...runtime].sort(),
    types: [...types].sort(),
  };
}

export async function loadRuntimeNamedExports(packageRoot, importEntry) {
  const href = pathToFileURL(join(packageRoot, importEntry)).href;
  const mod = await import(href);
  return [...new Set(Object.keys(mod))].sort();
}

export function loadDeclarationNamedExports(packageRoot, typesEntry) {
  const text = readFileSync(join(packageRoot, typesEntry), "utf8");
  return parseDeclarationNamedExports(text);
}

export function compareNamedExportParity({
  subpath,
  previousRuntime,
  candidateRuntime,
  previousDecl,
  candidateDecl,
  allowBreaking,
}) {
  assertNamedSuperset(previousRuntime, candidateRuntime, `${subpath} runtime named exports`, allowBreaking);

  const prevDeclValues = [...new Set([...previousDecl.runtime, ...previousDecl.types])].sort();
  const candDeclValues = [...new Set([...candidateDecl.runtime, ...candidateDecl.types])].sort();
  assertNamedSuperset(prevDeclValues, candDeclValues, `${subpath} declaration named exports`, allowBreaking);
}

function assertNamedSuperset(previousList, candidateList, label, allowBreaking) {
  const previous = new Set(previousList);
  const candidate = new Set(candidateList);
  const removed = [...previous].filter((item) => !candidate.has(item));
  if (removed.length && !allowBreaking) {
    throw new Error(
      `Named-export regression (${label}):\n${removed.map((item) => `  - ${item}`).join("\n")}\nUse workflow_dispatch with ALLOW_BREAKING_CONTRACT=true for intentional breaking changes.`,
    );
  }
  return removed;
}

export async function collectSubpathNamedExports(packageRoot, pkg, subpath) {
  const entry = pkg.exports?.[subpath];
  if (!entry || typeof entry !== "object") {
    throw new Error(`Cannot resolve export entry for ${subpath}`);
  }
  const importEntry = entry.import;
  const typesEntry = entry.types;
  if (!importEntry || !typesEntry) {
    throw new Error(`Export ${subpath} missing import/types fields`);
  }

  const runtime = await loadRuntimeNamedExports(packageRoot, importEntry);
  const decl = loadDeclarationNamedExports(packageRoot, typesEntry);
  return { runtime, decl };
}

export async function verifyConfigNamedExportParity(previousRoot, candidateRoot, allowBreaking) {
  const previousPkg = JSON.parse(readFileSync(join(previousRoot, "package.json"), "utf8"));
  const candidatePkg = JSON.parse(readFileSync(join(candidateRoot, "package.json"), "utf8"));
  const subpaths = Object.keys(previousPkg.exports ?? {}).sort();

  for (const subpath of subpaths) {
    if (!(subpath in (candidatePkg.exports ?? {}))) {
      throw new Error(`Export subpath removed: ${subpath}`);
    }

    const previous = await collectSubpathNamedExports(previousRoot, previousPkg, subpath);
    const candidate = await collectSubpathNamedExports(candidateRoot, candidatePkg, subpath);

    compareNamedExportParity({
      subpath,
      previousRuntime: previous.runtime,
      candidateRuntime: candidate.runtime,
      previousDecl: previous.decl,
      candidateDecl: candidate.decl,
      allowBreaking,
    });
  }
}
