export type CulturalStatus = 'current' | 'fading' | 'evergreen' | 'obscure' | 'unknown';

export interface CulturalReference {
  id: string;
  label: string;
  aliases: string[];
  domain: 'meme' | 'music' | 'film_tv' | 'sports' | 'gaming' | 'slang' | 'news' | 'creator' | 'other';
  status: CulturalStatus;
  relevance: number;
  familiarity: number;
  lastVerifiedAt: string;
  expiresAt?: string;
}

export interface CulturalContextInput {
  text: string;
  now?: string;
  audienceFamiliarity?: number;
}

export interface CulturalContextResult {
  references: CulturalReference[];
  current: CulturalReference[];
  evergreen: CulturalReference[];
}

/** Lightweight cultural knowledge registry. Freshness is explicit so stale references are not presented as current. */
export class CulturalContext {
  private readonly references = new Map<string, CulturalReference>();

  upsert(reference: CulturalReference): CulturalReference {
    this.references.set(reference.id, { ...reference, aliases: [...reference.aliases] });
    return { ...reference, aliases: [...reference.aliases] };
  }

  refresh(now = new Date().toISOString()): void {
    const at = Date.parse(now);
    for (const [id, ref] of this.references) {
      if (ref.expiresAt && Date.parse(ref.expiresAt) <= at && ref.status === 'current') {
        this.references.set(id, { ...ref, status: 'fading' });
      }
    }
  }

  findRelevant(input: CulturalContextInput): CulturalContextResult {
    this.refresh(input.now);
    const haystack = input.text.toLowerCase();
    const references = [...this.references.values()]
      .filter((ref) => [ref.label, ...ref.aliases].some((term) => haystack.includes(term.toLowerCase())))
      .filter((ref) => (input.audienceFamiliarity ?? 0.5) >= ref.familiarity * 0.5)
      .sort((a, b) => b.relevance - a.relevance);
    return {
      references: references.map((r) => ({ ...r, aliases: [...r.aliases] })),
      current: references.filter((r) => r.status === 'current').map((r) => ({ ...r, aliases: [...r.aliases] })),
      evergreen: references.filter((r) => r.status === 'evergreen').map((r) => ({ ...r, aliases: [...r.aliases] })),
    };
  }

  snapshot(): CulturalReference[] {
    return [...this.references.values()].map((r) => ({ ...r, aliases: [...r.aliases] }));
  }
}
