import fs from "node:fs";

/** Forbidden stack terms — regex with word boundaries where needed. */
export const FORBIDDEN_TERM_PATTERNS = [
  /\bPostgreSQL\b/i,
  /\bNeon\b/i,
  /\bPrisma\b/i,
  /\bCloud Run\b/i,
  /\bGCP\b/i,
  /\bRedis\b/i,
  /\bDocker Compose\b/i,
  /\bKubernetes\b/i,
  /\bVercel\b/i,
  /\bNetlify\b/i,
  /\bHeroku\b/i,
  /\bRailway\b/i,
  /\bRender\b(?!er)/i,
];

/** @deprecated use FORBIDDEN_TERM_PATTERNS */
export const FORBIDDEN_TERMS = [
  "PostgreSQL",
  "Neon",
  "Prisma",
  "Cloud Run",
  "GCP",
  "Redis",
  "Docker Compose",
  "Kubernetes",
  "Vercel",
  "Netlify",
  "Heroku",
  "Railway",
  "Render",
];

/** Line-level negative context allowlist (case-insensitive). */
export const NEGATIVE_CONTEXT_PATTERNS = [
  /\bforbidden\b/i,
  /\bverboden\b/i,
  /\bniet gebruiken\b/i,
  /\bgeen\b/i,
  /\bnooit\b/i,
  /\blegacy\b/i,
  /\barchived\b/i,
  /\bhistorisch\b/i,
  /\bremoved\b/i,
  /\buitgesloten\b/i,
  /\bniet bouwen\b/i,
  /\bweigert\b/i,
  /\bexcerpt\b/i,
  /\bmanifest\b/i,
];

/**
 * @param {string} line
 * @param {string} term
 */
export function isNegativeContext(line, term) {
  if (NEGATIVE_CONTEXT_PATTERNS.some((pattern) => pattern.test(line))) {
    return true;
  }
  if (/^\s*[-*]\s/.test(line) && line.includes(term)) {
    return true;
  }
  return false;
}

/**
 * @param {string} content
 * @param {string} fileLabel
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function lintForbiddenStackTerms(content, fileLabel) {
  /** @type {string[]} */
  const violations = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of FORBIDDEN_TERM_PATTERNS) {
      const match = line.match(pattern);
      if (!match) {
        continue;
      }
      const term = match[0];
      if (isNegativeContext(line, term)) {
        continue;
      }
      violations.push(
        `${fileLabel}:${i + 1}: positive context for forbidden term "${term}" — ${line.trim()}`,
      );
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * @param {string[]} filePaths absolute paths
 * @param {(p: string) => string} labelFn
 */
export function lintForbiddenStackFiles(filePaths, labelFn) {
  /** @type {string[]} */
  const allViolations = [];
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const content = fs.readFileSync(filePath, "utf8");
    const result = lintForbiddenStackTerms(content, labelFn(filePath));
    allViolations.push(...result.violations);
  }
  return { ok: allViolations.length === 0, violations: allViolations };
}
