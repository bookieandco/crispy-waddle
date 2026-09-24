import type { GrowthId } from '../domain/types.js';

export interface EntityMention {
  readonly id: GrowthId;
  readonly label: string;
  readonly source: string;
  readonly aliases?: readonly string[];
  readonly externalIds?: Readonly<Record<string, string>>;
}

export interface CanonicalEntity {
  readonly id: GrowthId;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly externalIds: Readonly<Record<string, string>>;
}

export interface EntityResolution {
  readonly mentionId: GrowthId;
  readonly canonicalId: GrowthId;
  readonly confidence: number;
  readonly method: 'external_id' | 'exact_alias' | 'normalized_label' | 'unresolved';
  readonly evidence: readonly string[];
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function resolveEntity(mention: EntityMention, canonicals: readonly CanonicalEntity[]): EntityResolution {
  for (const entity of canonicals) {
    for (const [provider, externalId] of Object.entries(entity.externalIds)) {
      if (mention.externalIds?.[provider] && mention.externalIds[provider] === externalId) {
        return { mentionId: mention.id, canonicalId: entity.id, confidence: 1, method: 'external_id', evidence: [`${provider}:${externalId}`] };
      }
    }
  }
  const mentionAliases = [mention.label, ...(mention.aliases ?? [])].map(normalize);
  for (const entity of canonicals) {
    const aliases = [entity.label, ...entity.aliases].map(normalize);
    if (mentionAliases.some((alias) => aliases.includes(alias))) {
      return { mentionId: mention.id, canonicalId: entity.id, confidence: 0.95, method: 'exact_alias', evidence: mentionAliases.filter((alias) => aliases.includes(alias)) };
    }
  }
  const normalized = normalize(mention.label);
  const match = canonicals.find((entity) => normalize(entity.label) === normalized);
  if (match) return { mentionId: mention.id, canonicalId: match.id, confidence: 0.85, method: 'normalized_label', evidence: [normalized] };
  return { mentionId: mention.id, canonicalId: mention.id, confidence: clamp(0), method: 'unresolved', evidence: ['no_canonical_match'] };
}
