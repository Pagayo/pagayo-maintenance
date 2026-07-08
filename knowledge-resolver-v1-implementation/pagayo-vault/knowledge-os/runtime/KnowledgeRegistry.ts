import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import type { CanonRegistryFile, KnowledgeResolverOptions, RegistryEntry } from './types.js';
import { DocumentNotFoundError } from './types.js';

const runtimeDir = dirname(fileURLToPath(import.meta.url));
const defaultCanonRegistryPath = join(runtimeDir, '../03-registry/canon-registry.yaml');

export class KnowledgeRegistry {
  private static instance: KnowledgeRegistry | null = null;

  private readonly canonRegistryPath: string;
  private entries = new Map<string, RegistryEntry>();
  private loaded = false;
  private loadCount = 0;

  private constructor(options: KnowledgeResolverOptions = {}) {
    this.canonRegistryPath = options.canonRegistryPath ?? defaultCanonRegistryPath;
  }

  static getInstance(options?: KnowledgeResolverOptions): KnowledgeRegistry {
    if (!KnowledgeRegistry.instance) {
      KnowledgeRegistry.instance = new KnowledgeRegistry(options);
    }
    return KnowledgeRegistry.instance;
  }

  static resetForTests(): void {
    KnowledgeRegistry.instance = null;
  }

  load(): void {
    if (this.loaded) {
      return;
    }

    const raw = readFileSync(this.canonRegistryPath, 'utf8');
    const parsed = parseYaml(raw) as CanonRegistryFile;

    for (const entry of parsed.entries) {
      this.entries.set(entry.id, entry);
    }

    this.loaded = true;
    this.loadCount += 1;
  }

  getLoadCount(): number {
    return this.loadCount;
  }

  resolveDocument(id: string): RegistryEntry {
    this.load();

    const entry = this.entries.get(id);
    if (!entry) {
      throw new DocumentNotFoundError(id);
    }

    return entry;
  }

  tryResolveDocument(id: string): RegistryEntry | null {
    this.load();
    return this.entries.get(id) ?? null;
  }

  getAllEntries(): RegistryEntry[] {
    this.load();
    return [...this.entries.values()];
  }
}
