export type RegistryEntryType =
  | 'knowledge-canon'
  | 'mission-canon'
  | 'platform-canon'
  | 'stack-canon'
  | 'ai-canon'
  | 'reference'
  | 'adr'
  | 'playbook'
  | 'historical';

export type TopicBucket = 'canonical' | 'references' | 'adrs' | 'playbooks' | 'historical';

export type AiResolutionLayer = TopicBucket;

export interface RegistryEntry {
  id: string;
  title: string;
  type: RegistryEntryType;
  owner: string;
  status: string;
  path: string;
  supersedes: string[];
  references: string[];
}

export interface CanonRegistryFile {
  version: number;
  wave: number;
  entries: RegistryEntry[];
}

export interface TopicEntry {
  id: string;
  topic: string;
  owner: string;
  type: string;
  canonical: string[];
  references: string[];
  adrs: string[];
  playbooks: string[];
  historical: string[];
}

export interface TopicRegistryFile {
  version: number;
  wave: number;
  'resolve-order': TopicBucket[];
  capabilities?: CapabilityEntry[];
  topics: TopicEntry[];
}

export interface CapabilityEntry {
  id: string;
  capability: string;
  topics: string[];
}

export interface CapabilityResolution {
  capability: string;
  capabilityId: string;
  topics: string[];
  layers: AiResolutionLayer[];
  canonical: ResolvedDocument[];
  references: ResolvedDocument[];
  adrs: ResolvedDocument[];
  documents: ResolvedDocument[];
}

export interface ResolvedDocument {
  id: string;
  title: string;
  type: RegistryEntryType;
  owner: string;
  status: string;
  path: string;
}

export interface TopicResolution {
  topicId: string;
  topic: string;
  owner: string;
  type: string;
  canonical: ResolvedDocument[];
  references: ResolvedDocument[];
  adrs: ResolvedDocument[];
  playbooks: ResolvedDocument[];
  historical: ResolvedDocument[];
}

export interface AiTopicResolution {
  topicId: string;
  topic: string;
  layers: AiResolutionLayer[];
  documents: ResolvedDocument[];
}

export interface ResolveForAiOptions {
  includePlaybooks?: boolean;
  includeHistorical?: boolean;
}

export interface KnowledgeResolverOptions {
  canonRegistryPath?: string;
  topicRegistryPath?: string;
}

export class TopicNotFoundError extends Error {
  constructor(topic: string) {
    super(`Unknown topic: ${topic}`);
    this.name = 'TopicNotFoundError';
  }
}

export class CapabilityNotFoundError extends Error {
  constructor(capability: string) {
    super(`Unknown capability: ${capability}`);
    this.name = 'CapabilityNotFoundError';
  }
}

export class DocumentNotFoundError extends Error {
  constructor(id: string) {
    super(`Unknown registry document: ${id}`);
    this.name = 'DocumentNotFoundError';
  }
}
