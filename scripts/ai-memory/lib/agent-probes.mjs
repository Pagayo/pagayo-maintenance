/**
 * Agent delivery probes — verify mirrors are bootstrap-ready (G9).
 */

/** @typedef {{ id: string, label: string, patterns: RegExp[] }} DeliveryProbe */

/** @type {DeliveryProbe[]} */
export const DELIVERY_PROBES = [
  {
    id: "conflict-order",
    label: "Conflict-order",
    patterns: [/Code \+ tests > STACK-MANIFEST\.md > PAGAYO-WHY\.md > ADR/],
  },
  {
    id: "product-pillars",
    label: "Product Pillars",
    patterns: [/## Product Pillars/, /\*\*Order First\*\*/],
  },
  {
    id: "build-pillars",
    label: "Build Pillars",
    patterns: [/## Build Pillars/, /\*\*Edge-First\*\*/],
  },
  {
    id: "cloudflare-only",
    label: "Cloudflare-only",
    patterns: [/100% op Cloudflare/i],
  },
  {
    id: "order-first",
    label: "Order First",
    patterns: [/Order First/, /orderId/],
  },
  {
    id: "local-only-boundary",
    label: "Local-Only Knowledge Boundary",
    patterns: [
      /## Local-Only Knowledge Boundary/,
      /Planning rule: every plan that references local-only sources/,
    ],
  },
];

/**
 * @param {string} content
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function probeDeliveryContent(content) {
  /** @type {string[]} */
  const missing = [];
  for (const probe of DELIVERY_PROBES) {
    const matched = probe.patterns.every((pattern) => pattern.test(content));
    if (!matched) {
      missing.push(probe.label);
    }
  }
  return { ok: missing.length === 0, missing };
}

/**
 * @param {Record<string, string>} mirrorContents keyed by mirror filename
 * @returns {{ ok: boolean, details: string[] }}
 */
export function probeAllMirrors(mirrorContents) {
  /** @type {string[]} */
  const details = [];
  for (const [fileName, content] of Object.entries(mirrorContents)) {
    const result = probeDeliveryContent(content);
    if (!result.ok) {
      details.push(`${fileName}: missing ${result.missing.join(", ")}`);
    }
  }
  return { ok: details.length === 0, details };
}
