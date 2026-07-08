import { afterEach, describe, expect, it } from 'vitest';

import { KnowledgeRegistry } from '../KnowledgeRegistry.js';
import { KnowledgeResolver } from '../KnowledgeResolver.js';
import { TopicResolver } from '../TopicResolver.js';
import { DocumentNotFoundError, CapabilityNotFoundError, TopicNotFoundError } from '../types.js';

describe('KnowledgeResolver', () => {
  afterEach(() => {
    KnowledgeRegistry.resetForTests();
    TopicResolver.resetForTests();
  });

  it('resolves an existing topic by name and id', () => {
    const resolver = new KnowledgeResolver();
    const byName = resolver.resolveTopic('AI');
    const byId = resolver.resolveTopic('TOPIC-AI');

    expect(byName.topicId).toBe('TOPIC-AI');
    expect(byId.topic).toBe('AI');
    expect(byName.canonical.map((doc) => doc.id)).toEqual([
      'CANON-AI-L1-0001',
      'KNOW-AI-BOOT-0001',
    ]);
    expect(byName.references.map((doc) => doc.id)).toEqual([
      'REF-MCP-STRATEGY-0001',
      'CANON-AGENTS-0001',
    ]);
    expect(byName.adrs).toEqual([]);
    expect(byName.playbooks).toEqual([]);
    expect(byName.historical).toEqual([]);
  });

  it('throws for an unknown topic', () => {
    const resolver = new KnowledgeResolver();

    expect(() => resolver.resolveTopic('NOT-A-TOPIC')).toThrow(TopicNotFoundError);
  });

  it('looks up a document by registry id', () => {
    const resolver = new KnowledgeResolver();
    const doc = resolver.resolveDocument('CANON-WHY-0001');

    expect(doc.id).toBe('CANON-WHY-0001');
    expect(doc.path).toBe('pagayo-vault/PAGAYO-WHY.md');
    expect(doc.type).toBe('mission-canon');
  });

  it('throws for an unknown document id', () => {
    const resolver = new KnowledgeResolver();

    expect(() => resolver.resolveDocument('MISSING-ID')).toThrow(DocumentNotFoundError);
  });

  it('returns AI resolution without playbooks or historical by default', () => {
    const resolver = new KnowledgeResolver();
    const ai = resolver.resolveForAI('Cloudflare');

    expect(ai.layers).toEqual(['canonical', 'references', 'adrs']);
    expect(ai.documents.map((doc) => doc.id)).toEqual([
      'CANON-STACK-0001',
      'REF-INFRA-MAINT-0001',
      'ADR-0006',
    ]);
    expect(ai.documents.some((doc) => doc.id === 'OPS-PB-02-0001')).toBe(false);
  });

  it('includes playbooks and historical only when explicitly requested', () => {
    const resolver = new KnowledgeResolver();
    const withPlaybooks = resolver.resolveForAI('Security', { includePlaybooks: true });
    const withHistorical = resolver.resolveForAI('Security', {
      includePlaybooks: true,
      includeHistorical: true,
    });

    expect(withPlaybooks.layers).toEqual(['canonical', 'references', 'adrs', 'playbooks']);
    expect(withPlaybooks.documents.some((doc) => doc.id === 'OPS-PB-00-0001')).toBe(true);
    expect(withHistorical.layers).toEqual([
      'canonical',
      'references',
      'adrs',
      'playbooks',
      'historical',
    ]);
  });

  it('loads registries once and reuses the cache', () => {
    const registry = KnowledgeRegistry.getInstance();
    const topics = TopicResolver.getInstance();

    registry.load();
    registry.load();
    topics.load();
    topics.load();

    expect(registry.getLoadCount()).toBe(1);
    expect(topics.getLoadCount()).toBe(1);

    const resolver = new KnowledgeResolver();
    resolver.resolveTopic('Orders');
    resolver.resolveDocument('CANON-NIVEAU-0001');

    expect(registry.getLoadCount()).toBe(1);
    expect(topics.getLoadCount()).toBe(1);
  });

  it('exposes the standard resolve order', () => {
    const resolver = new KnowledgeResolver();

    expect(resolver.getResolveOrder()).toEqual([
      'canonical',
      'references',
      'adrs',
      'playbooks',
      'historical',
    ]);
  });

  it('resolves commerce capability across topics with deduplication', () => {
    const resolver = new KnowledgeResolver();
    const result = resolver.resolveCapability('commerce');

    expect(result.capabilityId).toBe('CAP-COMMERCE');
    expect(result.topics).toEqual([
      'TOPIC-ORDERS',
      'TOPIC-PRODUCTS',
      'TOPIC-CUSTOMERS',
      'TOPIC-RETURNS',
    ]);
    expect(result.layers).toEqual(['canonical', 'references', 'adrs']);
    expect(result.canonical.map((doc) => doc.id)).toEqual(['ADR-0005', 'CANON-NIVEAU-0001']);
    expect(result.documents.map((doc) => doc.id)).toEqual([
      'ADR-0005',
      'CANON-NIVEAU-0001',
      'REF-DOC-ROUTER-SF-0001',
      'REF-ADMIN-MATRIX-0001',
      'REF-ORDERS-OVERVIEW-0001',
      'REF-PRODUCTS-OVERVIEW-0001',
      'REF-CUSTOMERS-OVERVIEW-0001',
      'ADR-0010',
    ]);
    expect(result.documents).toHaveLength(8);
  });

  it('resolves website capability from a single topic', () => {
    const resolver = new KnowledgeResolver();
    const result = resolver.resolveCapability('website');

    expect(result.capabilityId).toBe('CAP-WEBSITE');
    expect(result.topics).toEqual(['TOPIC-WEBSITE']);
    expect(result.documents.map((doc) => doc.id)).toEqual([
      'REF-WEBSITE-CAPABILITY-0001',
      'REF-FRONTEND-MATRIX-0001',
      'REF-DOC-ROUTER-SF-0001',
      'REF-SHOPBLOCKS-UX-0001',
      'ADR-SF-0001',
      'ADR-SF-0002',
    ]);
  });

  it('throws for an unknown capability', () => {
    const resolver = new KnowledgeResolver();

    expect(() => resolver.resolveCapability('NOT-A-CAPABILITY')).toThrow(
      CapabilityNotFoundError,
    );
  });
});
