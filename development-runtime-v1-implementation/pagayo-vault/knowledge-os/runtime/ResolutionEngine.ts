import { KnowledgeRegistry } from './KnowledgeRegistry.js';
import { TopicResolver } from './TopicResolver.js';
import type {
  AiResolutionLayer,
  AiTopicResolution,
  CapabilityResolution,
  RegistryEntry,
  ResolveForAiOptions,
  ResolvedDocument,
  TopicBucket,
  TopicResolution,
} from './types.js';

const TOPIC_BUCKETS: TopicBucket[] = [
  'canonical',
  'references',
  'adrs',
  'playbooks',
  'historical',
];

const AI_LAYERS: AiResolutionLayer[] = ['canonical', 'references', 'adrs'];

function toResolvedDocument(entry: RegistryEntry): ResolvedDocument {
  return {
    id: entry.id,
    title: entry.title,
    type: entry.type,
    owner: entry.owner,
    status: entry.status,
    path: entry.path,
  };
}

function resolveBucket(
  registry: KnowledgeRegistry,
  ids: string[],
): ResolvedDocument[] {
  return ids.map((id) => toResolvedDocument(registry.resolveDocument(id)));
}

function mergeDedupe(
  target: ResolvedDocument[],
  incoming: ResolvedDocument[],
): void {
  for (const document of incoming) {
    if (target.some((existing) => existing.id === document.id)) {
      continue;
    }
    target.push(document);
  }
}

function dedupeDocuments(documents: ResolvedDocument[]): ResolvedDocument[] {
  const seen = new Set<string>();
  const result: ResolvedDocument[] = [];

  for (const document of documents) {
    if (seen.has(document.id)) {
      continue;
    }
    seen.add(document.id);
    result.push(document);
  }

  return result;
}

export class ResolutionEngine {
  constructor(
    private readonly registry: KnowledgeRegistry,
    private readonly topicResolver: TopicResolver,
  ) {}

  resolveTopic(topic: string): TopicResolution {
    const topicEntry = this.topicResolver.resolveTopicKey(topic);

    return {
      topicId: topicEntry.id,
      topic: topicEntry.topic,
      owner: topicEntry.owner,
      type: topicEntry.type,
      canonical: resolveBucket(this.registry, topicEntry.canonical),
      references: resolveBucket(this.registry, topicEntry.references),
      adrs: resolveBucket(this.registry, topicEntry.adrs),
      playbooks: resolveBucket(this.registry, topicEntry.playbooks),
      historical: resolveBucket(this.registry, topicEntry.historical),
    };
  }

  resolveForAI(topic: string, options: ResolveForAiOptions = {}): AiTopicResolution {
    const resolution = this.resolveTopic(topic);
    const layers: AiResolutionLayer[] = [...AI_LAYERS];
    const documents: ResolvedDocument[] = [
      ...resolution.canonical,
      ...resolution.references,
      ...resolution.adrs,
    ];

    if (options.includePlaybooks) {
      layers.push('playbooks');
      documents.push(...resolution.playbooks);
    }

    if (options.includeHistorical) {
      layers.push('historical');
      documents.push(...resolution.historical);
    }

    return {
      topicId: resolution.topicId,
      topic: resolution.topic,
      layers,
      documents,
    };
  }

  resolveCapability(capability: string): CapabilityResolution {
    const capabilityEntry = this.topicResolver.resolveCapabilityKey(capability);
    const canonical: ResolvedDocument[] = [];
    const references: ResolvedDocument[] = [];
    const adrs: ResolvedDocument[] = [];

    for (const topicId of capabilityEntry.topics) {
      const topicEntry = this.topicResolver.getTopicById(topicId);
      const resolution = this.resolveTopic(topicEntry.topic);
      mergeDedupe(canonical, resolution.canonical);
      mergeDedupe(references, resolution.references);
      mergeDedupe(adrs, resolution.adrs);
    }

    const layers: AiResolutionLayer[] = [...AI_LAYERS];

    return {
      capability: capabilityEntry.capability,
      capabilityId: capabilityEntry.id,
      topics: [...capabilityEntry.topics],
      layers,
      canonical,
      references,
      adrs,
      documents: dedupeDocuments([...canonical, ...references, ...adrs]),
    };
  }

  getResolveOrder(): TopicBucket[] {
    return this.topicResolver.getResolveOrder();
  }
}

export { TOPIC_BUCKETS, AI_LAYERS };
