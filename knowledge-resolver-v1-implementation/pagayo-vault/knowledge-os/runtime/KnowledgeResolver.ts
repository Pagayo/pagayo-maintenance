import { KnowledgeRegistry } from './KnowledgeRegistry.js';
import { ResolutionEngine } from './ResolutionEngine.js';
import { TopicResolver } from './TopicResolver.js';
import type {
  AiTopicResolution,
  KnowledgeResolverOptions,
  RegistryEntry,
  ResolveForAiOptions,
  TopicResolution,
} from './types.js';

export class KnowledgeResolver {
  private readonly registry: KnowledgeRegistry;
  private readonly topicResolver: TopicResolver;
  private readonly engine: ResolutionEngine;

  constructor(options: KnowledgeResolverOptions = {}) {
    this.registry = KnowledgeRegistry.getInstance(options);
    this.topicResolver = TopicResolver.getInstance(options);
    this.engine = new ResolutionEngine(this.registry, this.topicResolver);
  }

  resolveTopic(topic: string): TopicResolution {
    return this.engine.resolveTopic(topic);
  }

  resolveDocument(id: string): RegistryEntry {
    return this.registry.resolveDocument(id);
  }

  resolveForAI(topic: string, options?: ResolveForAiOptions): AiTopicResolution {
    return this.engine.resolveForAI(topic, options);
  }

  getResolveOrder(): string[] {
    return this.engine.getResolveOrder();
  }
}
