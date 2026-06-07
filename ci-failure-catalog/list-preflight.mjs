#!/usr/bin/env node
import { loadCatalog } from "./lib.mjs";

const catalog = loadCatalog();
const hits = catalog.entries.filter(
  (e) => e.status === "active" && e.prevention?.layer === "preflight",
);

console.log(`${hits.length} active preflight catalog entries`);
for (const e of hits.slice(0, 8)) {
  console.log(`  • ${e.id} → ${e.prevention.ref}`);
}
