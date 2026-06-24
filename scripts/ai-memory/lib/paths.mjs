import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Workspace root: pagayo-maintenance/scripts/ai-memory/lib → ../../../.. */
const DEFAULT_WORKSPACE_ROOT = path.resolve(SCRIPT_DIR, "../../../..");

export const WORKSPACE_ROOT = process.env.AI_MEMORY_WORKSPACE_ROOT
  ? path.resolve(process.env.AI_MEMORY_WORKSPACE_ROOT)
  : DEFAULT_WORKSPACE_ROOT;

export const IS_CI_MODE =
  process.env.AI_MEMORY_CI === "1" || process.argv.includes("--ci");

export const L1_RELATIVE = "pagayo-vault/AI-OPERATING-CONTEXT.md";
export const L1_PATH = path.join(WORKSPACE_ROOT, L1_RELATIVE);

export const DELIVERY_DIR_RELATIVE = "pagayo-docs/ai-memory/delivery";
export const DELIVERY_DIR = path.join(WORKSPACE_ROOT, DELIVERY_DIR_RELATIVE);

/** CI self-test fixtures (public maintenance repo; private pagayo-docs is not cross-checkoutable). */
export const CI_FIXTURES_DELIVERY_DIR = path.resolve(SCRIPT_DIR, "../fixtures/delivery");

export const MIRROR_FILES = [
  "cursor-l1-context.md",
  "copilot-l1-context.md",
  "cloud-agent-l1-context.md",
];

export const MANIFEST_RELATIVE = `${DELIVERY_DIR_RELATIVE}/MANIFEST.json`;
export const MANIFEST_PATH = path.join(WORKSPACE_ROOT, MANIFEST_RELATIVE);

export const GENERATED_HEADER = "<!-- GENERATED FILE - DO NOT EDIT MANUALLY -->";
export const GENERATED_SOURCE_POINTER =
  "<!-- source: pagayo-vault/AI-OPERATING-CONTEXT.md -->";

export const GENERATOR_RELATIVE =
  "pagayo-maintenance/scripts/ai-memory/generate-ai-memory-delivery.mjs";

export const CURSOR_RULE_RELATIVE =
  ".cursor/rules/pagayo-l1-operating-context.mdc";

export const CURSOR_RULE_PATH = path.join(WORKSPACE_ROOT, CURSOR_RULE_RELATIVE);

export const MAX_L1_LINES = 250;

export const ACTIVE_REPOS = [
  "pagayo-storefront",
  "pagayo-api-stack",
  "pagayo-edge",
  "pagayo-workflows",
  "pagayo-marketing",
  "pagayo-design",
  "pagayo-config",
  "pagayo-schema",
  "pagayo-maintenance",
  "pagayo-cloudflare-proxy",
  "pagayo-docs",
  "pagayo-infra",
  "pagayo-vault",
  "pagayo-storefront-hotfix-home",
];
