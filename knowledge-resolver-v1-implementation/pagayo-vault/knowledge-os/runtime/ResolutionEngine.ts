import { KnowledgeRegistry } from './KnowledgeRegistry.js';
import { TopicResolver } from './TopicResolver.js';
import type {
  AiResolutionLayer,
  AiTopicResolution,
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

  getResolveOrder(): TopicBucket[] {
    return this.topicResolver.getResolveOrder();
  }
}

export { TOPIC_BUCKETS, AI_LAYERS };
