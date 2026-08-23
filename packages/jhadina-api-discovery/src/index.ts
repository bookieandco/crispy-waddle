export type ApiRiskClass = 'unknown' | 'low' | 'medium' | 'high' | 'critical';
export type ApiSideEffect = 'unknown' | 'read' | 'write' | 'financial' | 'destructive';
export type QualificationStatus = 'qualification_pending' | 'approved' | 'rejected';

export interface ApiCandidate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly externalUrl: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly riskClass: ApiRiskClass;
  readonly sideEffect: ApiSideEffect;
  readonly qualificationStatus: QualificationStatus;
}

export interface ApiDiscoverySource<TInput = string> {
  readonly name: string;
  discover(input: TInput): readonly ApiCandidate[];
}

export function normalizeExternalUrl(value: string): string {
  const url = new URL(value.trim());
  url.hash = '';
  return url.toString();
}

export function candidateId(externalUrl: string): string {
  return normalizeExternalUrl(externalUrl).toLowerCase();
}

export function deduplicateCandidates(candidates: readonly ApiCandidate[]): readonly ApiCandidate[] {
  const seen = new Set<string>();
  const result: ApiCandidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    result.push(candidate);
  }
  return result;
}

export class ApiMegaListMarkdownSource implements ApiDiscoverySource<string> {
  readonly name = 'cporter202/API-mega-list';

  constructor(
    private readonly category: string,
    private readonly sourceUrl = 'https://github.com/cporter202/API-mega-list',
  ) {}

  discover(markdown: string): readonly ApiCandidate[] {
    const candidates: ApiCandidate[] = [];
    const rowPattern = /^\|\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*\|\s*(.*?)\s*\|\s*$/gm;
    let match: RegExpExecArray | null;

    while ((match = rowPattern.exec(markdown)) !== null) {
      const [, name, externalUrl, description] = match;
      try {
        const normalizedUrl = normalizeExternalUrl(externalUrl);
        candidates.push({
          id: candidateId(normalizedUrl),
          name: name.trim(),
          description: description.trim(),
          category: this.category,
          externalUrl: normalizedUrl,
          source: this.name,
          sourceUrl: this.sourceUrl,
          riskClass: 'unknown',
          sideEffect: 'unknown',
          qualificationStatus: 'qualification_pending',
        });
      } catch {
        // Invalid source URLs are skipped rather than promoted to candidates.
      }
    }

    return deduplicateCandidates(candidates);
  }
}
