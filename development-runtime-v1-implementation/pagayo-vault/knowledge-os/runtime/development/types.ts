import type { AiTopicResolution, CapabilityResolution, ResolvedDocument } from '../types.js';

export interface CreateDevelopmentSessionInput {
  capability: string;
  task: string;
}

export interface DevelopmentContext {
  capability: string;
  capabilityId: string;
  task: string;
  topics: string[];
  topicResolutions: AiTopicResolution[];
  resolveOrder: string[];
  documentIds: string[];
}

export interface DevelopmentSessionResult {
  capability: string;
  canonical: ResolvedDocument[];
  references: ResolvedDocument[];
  adrs: ResolvedDocument[];
  developmentContext: DevelopmentContext;
  summary: string;
}

export interface DevelopmentRuntimeOptions {
  canonRegistryPath?: string;
  topicRegistryPath?: string;
}

export interface PipelineState {
  input: CreateDevelopmentSessionInput;
  capabilityResolution: CapabilityResolution;
  topicResolutions: AiTopicResolution[];
  canonical: ResolvedDocument[];
  references: ResolvedDocument[];
  adrs: ResolvedDocument[];
}
