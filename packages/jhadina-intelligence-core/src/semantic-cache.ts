import { createHash } from 'node:crypto';
import type { DecisionProposal } from '@jhadina/core-spine';
import type { IntelligencePrivacyClass } from './intelligence-fabric.js';

export interface SemanticCacheScope {
  readonly actorId: string;
  readonly tenantId?: string;
  readonly privacyClass: IntelligencePrivacyClass;
}

export interface SemanticCacheIdentity {
  readonly contextHash: string;
  readonly canonicalModelId: string;
  readonly modelVersion: string;
  readonly registryVersion: number;
  readonly evidenceIds: readonly string[];
  readonly scope: SemanticCacheScope;
}

export interface SemanticCacheEntry {
  readonly key: string;
  readonly identity: SemanticCacheIdentity;
  readonly proposal: DecisionProposal;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface SemanticCacheStore {
  get(key: string): Promise<SemanticCacheEntry | undefined>;
  put(entry: SemanticCacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
}

export class GovernedSemanticCache {
  constructor(private readonly store: SemanticCacheStore, private readonly now: () => Date = () => new Date()) {}

  key(identity: SemanticCacheIdentity): string {
    validate(identity);
    return createHash('sha256').update(JSON.stringify(normalize(identity))).digest('hex');
  }

  async get(identity: SemanticCacheIdentity): Promise<DecisionProposal | undefined> {
    const key = this.key(identity);
    const entry = await this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now().toISOString()) { await this.store.delete(key); return undefined; }
    if (key !== this.key(entry.identity)) { await this.store.delete(key); return undefined; }
    return structuredClone(entry.proposal);
  }

  async put(identity: SemanticCacheIdentity, proposal: DecisionProposal, ttlMs: number): Promise<void> {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error('SEMANTIC_CACHE_TTL_INVALID');
    validate(identity);
    const created = this.now();
    await this.store.put(Object.freeze({
      key: this.key(identity), identity: freezeIdentity(identity), proposal: structuredClone(proposal),
      createdAt: created.toISOString(), expiresAt: new Date(created.getTime() + ttlMs).toISOString(),
    }));
  }
}

export class InMemorySemanticCacheStore implements SemanticCacheStore {
  private readonly entries = new Map<string, SemanticCacheEntry>();
  async get(key:string){ return this.entries.get(key); }
  async put(entry:SemanticCacheEntry){ this.entries.set(entry.key, entry); }
  async delete(key:string){ this.entries.delete(key); }
}

function normalize(i:SemanticCacheIdentity){
  return {contextHash:i.contextHash,canonicalModelId:i.canonicalModelId,modelVersion:i.modelVersion,registryVersion:i.registryVersion,evidenceIds:[...new Set(i.evidenceIds)].sort(),scope:{actorId:i.scope.actorId,tenantId:i.scope.tenantId??null,privacyClass:i.scope.privacyClass}};
}
function validate(i:SemanticCacheIdentity){
  if(!/^[a-f0-9]{64}$/i.test(i.contextHash)) throw new Error('SEMANTIC_CACHE_CONTEXT_HASH_INVALID');
  if(!i.canonicalModelId||!i.modelVersion||!i.scope.actorId) throw new Error('SEMANTIC_CACHE_IDENTITY_INCOMPLETE');
  if(!Number.isInteger(i.registryVersion)||i.registryVersion<0) throw new Error('SEMANTIC_CACHE_REGISTRY_VERSION_INVALID');
}
function freezeIdentity(i:SemanticCacheIdentity):SemanticCacheIdentity{return Object.freeze({...i,evidenceIds:Object.freeze([...i.evidenceIds]),scope:Object.freeze({...i.scope})});}
