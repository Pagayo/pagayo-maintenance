import { KnowledgeRegistry } from '../KnowledgeRegistry.js';
import { KnowledgeResolver } from '../KnowledgeResolver.js';
import { TopicResolver } from '../TopicResolver.js';

import { DevelopmentPipeline } from './DevelopmentPipeline.js';
import type { CreateDevelopmentSessionInput, DevelopmentRuntimeOptions, DevelopmentSessionResult } from './types.js';

export class DevelopmentRuntime {
  private static instance: DevelopmentRuntime | null = null;

  private readonly pipeline: DevelopmentPipeline;
  private sessionCount = 0;

  private constructor(options: DevelopmentRuntimeOptions = {}) {
    const resolver = new KnowledgeResolver(options);
    this.pipeline = new DevelopmentPipeline(resolver);
  }

  static getInstance(options?: DevelopmentRuntimeOptions): DevelopmentRuntime {
    if (!DevelopmentRuntime.instance) {
      DevelopmentRuntime.instance = new DevelopmentRuntime(options);
    }
    return DevelopmentRuntime.instance;
  }

  static resetForTests(): void {
    DevelopmentRuntime.instance = null;
    KnowledgeRegistry.resetForTests();
    TopicResolver.resetForTests();
  }

  createDevelopmentSession(input: CreateDevelopmentSessionInput): DevelopmentSessionResult {
    this.sessionCount += 1;
    return this.pipeline.execute(input);
  }

  getSessionCount(): number {
    return this.sessionCount;
  }
}

export function createDevelopmentSession(
  input: CreateDevelopmentSessionInput,
  options?: DevelopmentRuntimeOptions,
): DevelopmentSessionResult {
  if (options) {
    const pipeline = new DevelopmentPipeline(new KnowledgeResolver(options));
    return pipeline.execute(input);
  }

  return DevelopmentRuntime.getInstance().createDevelopmentSession(input);
}
