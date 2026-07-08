import type { AiTopicResolution, CapabilityResolution } from '../types.js';
import type { CreateDevelopmentSessionInput, DevelopmentContext } from './types.js';

export class CapabilityContext {
  static build(
    input: CreateDevelopmentSessionInput,
    capabilityResolution: CapabilityResolution,
    topicResolutions: AiTopicResolution[],
    resolveOrder: string[],
  ): DevelopmentContext {
    const documentIds = [
      ...capabilityResolution.canonical,
      ...capabilityResolution.references,
      ...capabilityResolution.adrs,
    ].map((document) => document.id);

    return {
      capability: capabilityResolution.capability,
      capabilityId: capabilityResolution.capabilityId,
      task: input.task,
      topics: [...capabilityResolution.topics],
      topicResolutions,
      resolveOrder,
      documentIds,
    };
  }
}
