export const PROJECT_START_DATE = '2025-12-04';

export const REPOS = [
  'pagayo-storefront',
  'pagayo-api-stack',
  'pagayo-schema',
  'pagayo-design',
  'pagayo-config',
  'pagayo-edge',
  'pagayo-workflows',
  'pagayo-cloudflare-proxy',
  'pagayo-maintenance',
  'pagayo-marketing',
];

export const MAX_WEEK = 87;

export const EXCLUDE_TITLE_PATTERNS = [
  /\bdependabot\b/i,
  /\bdeps?\b/i,
  /\bbump\b/i,
  /\bchore\b/i,
  /\brefactor\b/i,
  /\binfra\b/i,
  /\btypo\b/i,
  /\blint\b/i,
  /\bformatting\b/i,
  /\bci\b/i,
  /\bworkflow\b/i,
  /\bmerge branch\b/i,
  /\bmerge main\b/i,
  /\bversion bump\b/i,
  /\blockfile\b/i,
  /\bpackage-lock\b/i,
];

export const EXCLUDE_BODY_TYPES = new Set(['chore', 'infra', 'refactor']);
