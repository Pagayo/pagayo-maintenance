import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import type { CapabilityEntry, KnowledgeResolverOptions, TopicEntry, TopicRegistryFile } from './types.js';
import { CapabilityNotFoundError, TopicNotFoundError } from './types.js';

const runtimeDir = dirname(fileURLToPath(import.meta.url));
const defaultTopicRegistryPath = join(runtimeDir, '../03-registry/topic-registry.yaml');

export class TopicResolver {
  private static instance: TopicResolver | null = null;

  private readonly topicRegistryPath: string;
  private topicsById = new Map<string, TopicEntry>();
  private topicsByName = new Map<string, TopicEntry>();
  private capabilitiesByKey = new Map<string, CapabilityEntry>();
  private resolveOrder: TopicRegistryFile['resolve-order'] = [];
  private loaded = false;
  private loadCount = 0;

  private constructor(options: KnowledgeResolverOptions = {}) {
    this.topicRegistryPath = options.topicRegistryPath ?? defaultTopicRegistryPath;
  }

  static getInstance(options?: KnowledgeResolverOptions): TopicResolver {
    if (!TopicResolver.instance) {
      TopicResolver.instance = new TopicResolver(options);
    }
    return TopicResolver.instance;
  }

  static resetForTests(): void {
    TopicResolver.instance = null;
  }

  load(): void {
    if (this.loaded) {
      return;
    }

    const raw = readFileSync(this.topicRegistryPath, 'utf8');
    const parsed = parseYaml(raw) as TopicRegistryFile;

    this.resolveOrder = parsed['resolve-order'];

    for (const topic of parsed.topics) {
      this.topicsById.set(topic.id, topic);
      this.topicsByName.set(topic.topic.toLowerCase(), topic);
      this.topicsByName.set(topic.id.toLowerCase(), topic);
    }

    for (const capability of parsed.capabilities ?? []) {
      this.capabilitiesByKey.set(capability.capability.toLowerCase(), capability);
      this.capabilitiesByKey.set(capability.id.toLowerCase(), capability);
    }

    this.loaded = true;
    this.loadCount += 1;
  }

  getLoadCount(): number {
    return this.loadCount;
  }

  getResolveOrder(): TopicRegistryFile['resolve-order'] {
    this.load();
    return [...this.resolveOrder];
  }

  resolveTopicKey(topic: string): TopicEntry {
    this.load();

    const normalized = topic.trim().toLowerCase();
    const match = this.topicsById.get(topic) ?? this.topicsByName.get(normalized);

    if (!match) {
      throw new TopicNotFoundError(topic);
    }

    return match;
  }

  resolveCapabilityKey(capability: string): CapabilityEntry {
    this.load();

    const normalized = capability.trim().toLowerCase();
    const match = this.capabilitiesByKey.get(normalized);

    if (!match) {
      throw new CapabilityNotFoundError(capability);
    }

    return match;
  }

  getTopicById(topicId: string): TopicEntry {
    this.load();

    const match = this.topicsById.get(topicId);
    if (!match) {
      throw new TopicNotFoundError(topicId);
    }

    return match;
  }
}
