import type { DevelopmentSessionResult, PipelineState } from './types.js';

export class DevelopmentSession {
  static fromPipelineState(state: PipelineState, developmentContext: DevelopmentSessionResult['developmentContext']): DevelopmentSessionResult {
    const documentCount =
      state.canonical.length + state.references.length + state.adrs.length;

    return {
      capability: state.capabilityResolution.capability,
      canonical: state.canonical,
      references: state.references,
      adrs: state.adrs,
      developmentContext,
      summary: `Development session for ${state.capabilityResolution.capability}: ${documentCount} documents across ${state.capabilityResolution.topics.length} topics`,
    };
  }
}
