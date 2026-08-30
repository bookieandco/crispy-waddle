export type ResearchIntentKind = 'current' | 'cultural' | 'stored-knowledge' | 'factual' | 'opinion' | 'technical' | 'historical' | 'mixed';

export interface ResearchIntent {
  query: string;
  kinds: ResearchIntentKind[];
  primary: ResearchIntentKind;
  freshnessRequired: boolean;
  communitySignalUseful: boolean;
  storedEvidenceUseful: boolean;
  primarySourcesPreferred: boolean;
  verificationRequired: boolean;
  confidence: number;
}

export interface ResearchIntentClassifier {
  classify(query: string): ResearchIntent;
}

/** Deterministic baseline classifier. It produces structured intent; source selection owns routing. */
export class StructuredResearchIntentClassifier implements ResearchIntentClassifier {
  classify(query: string): ResearchIntent {
    const q = query.toLowerCase();
    const kinds = new Set<ResearchIntentKind>();
    if (/today|latest|current|now|recent|breaking|this week|this month/.test(q)) kinds.add('current');
    if (/meme|slang|trend|viral|culture|community|reddit|what .*people|talking about/.test(q)) kinds.add('cultural');
    if (/remember|previous|our history|my history|stored|what do we know|our knowledge/.test(q)) kinds.add('stored-knowledge');
    if (/is it true|fact|facts|verify|true|false|when did|who is|where is|how many|statistics|statistic/.test(q)) kinds.add('factual');
    if (/should|would you|recommend|best|worth it|opinion|think about|thoughts on/.test(q)) kinds.add('opinion');
    if (/api|code|programming|software|database|typescript|javascript|python|technical|algorithm|github/.test(q)) kinds.add('technical');
    if (/history|historical|ancient|originally|in \d{4}/.test(q)) kinds.add('historical');
    if (!kinds.size) kinds.add('factual');
    const ordered: ResearchIntentKind[] = ['current','cultural','stored-knowledge','factual','technical','historical','opinion'];
    const ranked = ordered.filter((k) => kinds.has(k));
    const primary = ranked[0] ?? 'factual';
    return {
      query,
      kinds: ranked,
      primary,
      freshnessRequired: kinds.has('current'),
      communitySignalUseful: kinds.has('cultural') || kinds.has('opinion'),
      storedEvidenceUseful: kinds.has('stored-knowledge') || kinds.has('historical'),
      primarySourcesPreferred: kinds.has('factual') || kinds.has('technical') || kinds.has('historical'),
      verificationRequired: true,
      confidence: ranked.length === 1 ? 0.8 : 0.62,
    };
  }
}
