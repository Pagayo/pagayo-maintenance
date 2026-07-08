import { afterEach, describe, expect, it } from 'vitest';

import { KnowledgeRegistry } from '../../KnowledgeRegistry.js';
import { TopicResolver } from '../../TopicResolver.js';
import { CapabilityNotFoundError } from '../../types.js';
import { createDevelopmentSession, DevelopmentRuntime } from '../index.js';

describe('DevelopmentRuntime', () => {
  afterEach(() => {
    DevelopmentRuntime.resetForTests();
  });

  it('creates a commerce development session', () => {
    const session = createDevelopmentSession({
      capability: 'commerce',
      task: 'Implement order list filters',
    });

    expect(session.capability).toBe('commerce');
    expect(session.developmentContext.task).toBe('Implement order list filters');
    expect(session.developmentContext.topics).toEqual([
      'TOPIC-ORDERS',
      'TOPIC-PRODUCTS',
      'TOPIC-CUSTOMERS',
      'TOPIC-RETURNS',
    ]);
    expect(session.canonical.map((doc) => doc.id)).toEqual(['ADR-0005', 'CANON-NIVEAU-0001']);
    expect(session.adrs.map((doc) => doc.id)).toEqual(['ADR-0010']);
    expect(session.developmentContext.topicResolutions).toHaveLength(4);
    expect(session.summary).toContain('commerce');
  });

  it('creates a website development session', () => {
    const session = createDevelopmentSession({
      capability: 'website',
      task: 'Update homepage capability map',
    });

    expect(session.capability).toBe('website');
    expect(session.canonical.map((doc) => doc.id)).toEqual(['REF-WEBSITE-CAPABILITY-0001']);
    expect(session.references.map((doc) => doc.id)).toEqual([
      'REF-FRONTEND-MATRIX-0001',
      'REF-DOC-ROUTER-SF-0001',
      'REF-SHOPBLOCKS-UX-0001',
    ]);
    expect(session.adrs.map((doc) => doc.id)).toEqual(['ADR-SF-0001', 'ADR-SF-0002']);
    expect(session.developmentContext.topicResolutions).toHaveLength(1);
  });

  it('creates a knowledge-os development session', () => {
    const session = createDevelopmentSession({
      capability: 'knowledge-os',
      task: 'Extend topic registry',
    });

    expect(session.capability).toBe('knowledge-os');
    expect(session.canonical.length).toBeGreaterThan(0);
    expect(session.references.length).toBeGreaterThan(0);
    expect(session.adrs).toEqual([]);
    expect(session.developmentContext.resolveOrder).toEqual([
      'canonical',
      'references',
      'adrs',
      'playbooks',
      'historical',
    ]);
  });

  it('throws for an unknown capability', () => {
    expect(() =>
      createDevelopmentSession({
        capability: 'NOT-A-CAPABILITY',
        task: 'Should fail',
      }),
    ).toThrow(CapabilityNotFoundError);
  });

  it('reuses resolver cache across sessions', () => {
    const registry = KnowledgeRegistry.getInstance();
    const topics = TopicResolver.getInstance();

    createDevelopmentSession({ capability: 'commerce', task: 'First' });
    createDevelopmentSession({ capability: 'website', task: 'Second' });

    expect(registry.getLoadCount()).toBe(1);
    expect(topics.getLoadCount()).toBe(1);
    expect(DevelopmentRuntime.getInstance().getSessionCount()).toBe(2);
  });
});
