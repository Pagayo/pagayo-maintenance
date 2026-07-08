import { KnowledgeResolver } from '../KnowledgeResolver.js';
import { TopicResolver } from '../TopicResolver.js';

import { CapabilityContext } from './CapabilityContext.js';
import { DevelopmentSession } from './DevelopmentSession.js';
import type { CreateDevelopmentSessionInput, DevelopmentSessionResult } from './types.js';

export class DevelopmentPipeline {
  constructor(private readonly resolver: KnowledgeResolver) {}

  execute(input: CreateDevelopmentSessionInput): DevelopmentSessionResult {
    const capabilityResolution = this.resolver.resolveCapability(input.capability);

    const topicResolver = TopicResolver.getInstance();
    const topicResolutions = capabilityResolution.topics.map((topicId) => {
      const topicEntry = topicResolver.getTopicById(topicId);
      return this.resolver.resolveForAI(topicEntry.topic);
    });

    const canonical = [...capabilityResolution.canonical];
    const references = [...capabilityResolution.references];
    const adrs = [...capabilityResolution.adrs];

    const developmentContext = CapabilityContext.build(
      input,
      capabilityResolution,
      topicResolutions,
      this.resolver.getResolveOrder(),
    );

    return DevelopmentSession.fromPipelineState(
      {
        input,
        capabilityResolution,
        topicResolutions,
        canonical,
        references,
        adrs,
      },
      developmentContext,
    );
  }
}
