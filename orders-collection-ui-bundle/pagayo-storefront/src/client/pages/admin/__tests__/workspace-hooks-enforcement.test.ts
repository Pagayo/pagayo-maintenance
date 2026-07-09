import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ADMIN_PAGES_DIR = join(__dirname, "..");

/**
 * Pagina's die nog niet gemigreerd zijn naar useWorkspaceSelection.
 * Verwijder een pagina uit deze lijst zodra die gemigreerd is.
 * Doel: deze lijst naar [] brengen.
 */
const ALLOWED_EXCEPTIONS: string[] = [
  "OrdersPage.tsx",
  "SubscriptionHoldersPage.tsx",
  "CouponsPage.tsx",
  "FaqPage.tsx",
];

describe("Workspace hooks enforcement", () => {
  const pageFiles = readdirSync(ADMIN_PAGES_DIR).filter((f) =>
    f.endsWith("Page.tsx"),
  );

  it.each(pageFiles)(
    "%s should not use standalone Set state for selection",
    (file) => {
      const content = readFileSync(join(ADMIN_PAGES_DIR, file), "utf-8");
      if (ALLOWED_EXCEPTIONS.includes(file)) return;

      // Detecteer useState<Set<...>> patronen die duidelijk selectie-state zijn
      // (variabelenaam bevat "selected" of "selection")
      const hasStandaloneSelectionState =
        /\bconst\s+\[selected\w*,\s*set\w*\]\s*=\s*useState<Set</.test(content);

      expect(
        hasStandaloneSelectionState,
        `${file} bevat standalone useState<Set<...>> voor selectie. Gebruik useWorkspaceSelection hook.`,
      ).toBe(false);
    },
  );

  it.each(pageFiles)(
    "%s should not have manual selectionAnchorIndex",
    (file) => {
      const content = readFileSync(join(ADMIN_PAGES_DIR, file), "utf-8");
      if (ALLOWED_EXCEPTIONS.includes(file)) return;

      const hasAnchorIndex = /selectionAnchor/i.test(content);

      expect(
        hasAnchorIndex,
        `${file} bevat handmatige selectionAnchor. Gebruik useWorkspaceSelection hook.`,
      ).toBe(false);
    },
  );
});
