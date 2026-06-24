import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./paths.mjs";

const SOURCE_ANCHOR_RE = /<!--\s*source:\s*([^#>\s]+)(?:#([^\s>]+))?\s*-->/g;
const SECTION_HEADER_RE = /^##\s+/;

/**
 * @param {string} content
 * @returns {Array<{ title: string, body: string, anchors: string[] }>}
 */
export function parseSections(content) {
  const lines = content.split("\n");
  /** @type {Array<{ title: string, body: string, anchors: string[] }>} */
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (SECTION_HEADER_RE.test(line)) {
      if (current) {
        sections.push(current);
      }
      current = {
        title: line.replace(/^##\s+/, "").trim(),
        body: "",
        anchors: [],
      };
      continue;
    }
    if (current) {
      current.body += `${line}\n`;
      const anchorMatch = line.match(/<!--\s*source:\s*([^#>\s]+)(?:#([^\s>]+))?\s*-->/);
      if (anchorMatch) {
        current.anchors.push(
          `${anchorMatch[1]}${anchorMatch[2] ? `#${anchorMatch[2]}` : ""}`,
        );
      }
    }
  }
  if (current) {
    sections.push(current);
  }
  return sections;
}

/**
 * GitHub-style heading slug (approximate).
 * @param {string} heading
 */
export function headingToSlug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[→]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[():,/]/g, " ")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * @param {string} slug
 */
export function normalizeAnchorSlug(slug) {
  return slug
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, "");
}

/**
 * @param {string} wanted
 * @param {string} candidate
 */
export function anchorSlugMatches(wanted, candidate) {
  if (wanted === candidate) {
    return true;
  }
  return normalizeAnchorSlug(wanted) === normalizeAnchorSlug(candidate);
}

/**
 * @param {string} markdown
 * @returns {Set<string>}
 */
export function collectHeadingSlugs(markdown) {
  /** @type {Set<string>} */
  const slugs = new Set();
  for (const line of markdown.split("\n")) {
    const match = line.match(/^#{1,6}\s+(.+)$/);
    if (!match) {
      continue;
    }
    slugs.add(headingToSlug(match[1].trim()));
  }
  return slugs;
}

/**
 * @param {string} filePath workspace-relative or absolute
 * @param {string} [anchorSlug]
 */
export function resolveSourceFile(filePath) {
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.join(WORKSPACE_ROOT, filePath);
  if (!fs.existsSync(absolute)) {
    return { ok: false, absolute, reason: "file not found" };
  }
  return { ok: true, absolute, reason: null };
}

/**
 * @param {string} content
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateSourceAnchors(content) {
  const sections = parseSections(content);
  /** @type {string[]} */
  const errors = [];

  for (const section of sections) {
    if (section.anchors.length === 0) {
      errors.push(`Section "${section.title}" missing <!-- source: ... --> anchor`);
      continue;
    }
    for (const anchor of section.anchors) {
      const [filePart, slugPart] = anchor.split("#");
      const resolved = resolveSourceFile(filePart);
      if (!resolved.ok) {
        errors.push(`Anchor file missing for "${section.title}": ${filePart}`);
        continue;
      }
      if (slugPart) {
        const fileContent = fs.readFileSync(resolved.absolute, "utf8");
        const slugs = collectHeadingSlugs(fileContent);
        const normalizedWanted = slugPart;
        const matched = [...slugs].some((slug) =>
          anchorSlugMatches(normalizedWanted, slug),
        );
        if (!matched) {
          errors.push(
            `Anchor slug not found for "${section.title}": ${anchor} (available: ${[...slugs].slice(0, 5).join(", ")}...)`,
          );
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * @param {string} content
 * @returns {string[]}
 */
export function extractAllAnchors(content) {
  /** @type {string[]} */
  const anchors = [];
  let match;
  const re = new RegExp(SOURCE_ANCHOR_RE.source, "g");
  while ((match = re.exec(content)) !== null) {
    anchors.push(`${match[1]}${match[2] ? `#${match[2]}` : ""}`);
  }
  return anchors;
}
