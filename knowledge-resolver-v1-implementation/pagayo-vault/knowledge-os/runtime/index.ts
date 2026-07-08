export { KnowledgeResolver } from './KnowledgeResolver.js';
export { KnowledgeRegistry } from './KnowledgeRegistry.js';
export { TopicResolver } from './TopicResolver.js';
export { ResolutionEngine, AI_LAYERS, TOPIC_BUCKETS } from './ResolutionEngine.js';
export type {
  AiResolutionLayer,
  AiTopicResolution,
  CanonRegistryFile,
  KnowledgeResolverOptions,
  RegistryEntry,
  RegistryEntryType,
  ResolveForAiOptions,
  ResolvedDocument,
  TopicBucket,
  TopicEntry,
  TopicRegistryFile,
  TopicResolution,
} from './types.js';
export { DocumentNotFoundError, TopicNotFoundError } from './types.js';
