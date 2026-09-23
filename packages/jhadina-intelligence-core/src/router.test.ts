import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContextPacket, DecisionProposal } from '@jhadina/core-spine';
import { IntelligenceRouter, ModelProviderFailedError, type ModelProvider, type IntelligenceRouterEvent } from './router.js';

function baseContext(): ContextPacket {
  return {
    id: 'ctx-1',
    purpose: 'test',
    relevantMemories: [],
    patterns: [],
    personality: { version: 1, traits: [], independentAssessmentRequired: false, updatedAt: new Date().toISOString() },
    knowledge: [],
    constraints: [],
    excludedContext: [],
  };
}

function proposalFor(disposition: DecisionProposal['disposition']): DecisionProposal {
  return {
    id: 'proposal-1',
    contextId: 'ctx-1',
    disposition,
    recommendation: 'do the thing',
    rationale: 'because reasons',
    evidence: [],
    uncertainty: [],
    alternatives: [],
  };
}

function providerThatSucceeds(name: string, proposal: DecisionProposal): ModelProvider {
  return { name, propose: async () => proposal };
}

function providerThatFails(name: string, error: unknown = new Error('down')): ModelProvider {
  return {
    name,
    propose: async () => {
      throw error;
    },
  };
}

test('uses the primary provider when it succeeds, never touching the fallback', async () => {
  let fallbackCalled = false;
  const primary = providerThatSucceeds('primary', proposalFor('PROCEED'));
  const fallback: ModelProvider = {
    name: 'fallback',
    propose: async () => {
      fallbackCalled = true;
      return proposalFor('ASK');
    },
  };

  const router = new IntelligenceRouter({ primary, fallback });
  const result = await router.decide(baseContext());

  assert.equal(result.disposition, 'PROCEED');
  assert.equal(fallbackCalled, false);
});

test('falls back to the legacy/fallback provider when the primary is unavailable', async () => {
  const events: IntelligenceRouterEvent[] = [];
  const primary = providerThatFails('primary', new Error('CREDENTIAL_NOT_CONFIGURED:intelligence/anthropic'));
  const fallback = providerThatSucceeds('legacy-classifier', proposalFor('ASK'));

  const router = new IntelligenceRouter({ primary, fallback, onEvent: (e) => events.push(e) });
  const result = await router.decide(baseContext());

  assert.equal(result.disposition, 'ASK');
  assert.deepEqual(
    events.map((e) => e.stage),
    ['primary_failed', 'fallback_used'],
  );
});

test('fails closed with a tagged error when both providers fail — never fabricates a proposal', async () => {
  const events: IntelligenceRouterEvent[] = [];
  const primary = providerThatFails('primary');
  const fallback = providerThatFails('legacy-classifier');

  const router = new IntelligenceRouter({ primary, fallback, onEvent: (e) => events.push(e) });

  await assert.rejects(
    () => router.decide(baseContext()),
    (error: unknown) => error instanceof ModelProviderFailedError,
  );
  assert.deepEqual(
    events.map((e) => e.stage),
    ['primary_failed', 'fallback_failed'],
  );
});

test('a provider cannot be swapped for another without any router code change (provider-agnostic)', async () => {
  const providerA = providerThatSucceeds('provider-a', proposalFor('PROCEED'));
  const providerB = providerThatSucceeds('provider-b', proposalFor('DECLINE'));

  const routerWithA = new IntelligenceRouter({ primary: providerA, fallback: providerB });
  const routerWithB = new IntelligenceRouter({ primary: providerB, fallback: providerA });

  assert.equal((await routerWithA.decide(baseContext())).disposition, 'PROCEED');
  assert.equal((await routerWithB.decide(baseContext())).disposition, 'DECLINE');
});


test('canonicalizes provider evidence against the governed ContextPacket', async () => {
  const context = baseContext();
  context.knowledge = [{
    id: 'knowledge-1',
    source: 'knowledge-core',
    observedAt: '2026-09-22T12:00:00.000Z',
    summary: 'canonical knowledge',
    immutable: false,
  }];
  const modelProposal = proposalFor('PROCEED');
  modelProposal.evidence = [
    {
      id: 'knowledge-1',
      source: 'fabricated-source',
      observedAt: '2099-01-01T00:00:00.000Z',
      summary: 'fabricated summary',
    },
    {
      id: 'invented-1',
      source: 'model',
      observedAt: '2099-01-01T00:00:00.000Z',
      summary: 'invented evidence',
    },
  ];

  const router = new IntelligenceRouter({
    primary: providerThatSucceeds('primary', modelProposal),
    fallback: providerThatFails('fallback'),
  });
  const result = await router.decide(context);

  assert.deepEqual(result.evidence, [context.knowledge[0]]);
  assert.match(result.uncertainty.at(-1) ?? '', /1 provider evidence reference/);
});

test('binds fallback evidence too, so provider failover cannot bypass provenance', async () => {
  const context = baseContext();
  context.relevantMemories = [{
    id: 'memory-1',
    source: 'memory-core',
    observedAt: '2026-09-22T12:00:00.000Z',
    summary: 'approved memory',
    immutable: false,
  }];
  const fallbackProposal = proposalFor('ASK');
  fallbackProposal.evidence = [{
    id: 'memory-1',
    source: 'wrong-source',
    observedAt: '2099-01-01T00:00:00.000Z',
    summary: 'wrong summary',
  }];

  const events: IntelligenceRouterEvent[] = [];
  const router = new IntelligenceRouter({
    primary: providerThatFails('primary'),
    fallback: providerThatSucceeds('legacy-classifier', fallbackProposal),
    onEvent: (event) => events.push(event),
  });
  const result = await router.decide(context);

  assert.deepEqual(result.evidence, [context.relevantMemories[0]]);
  assert.deepEqual(events.map((event) => event.stage), ['primary_failed', 'fallback_used']);
});
