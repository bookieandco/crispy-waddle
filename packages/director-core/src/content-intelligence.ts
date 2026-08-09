export type ContentSourceKind = 'youtube' | 'music_library' | 'tv_library' | 'user_script' | 'user_movie' | 'user_note';

export type ContentReference = {
  id: string;
  kind: ContentSourceKind;
  title: string;
  creator?: string;
  sourceUrl?: string;
  userOwned?: boolean;
  rightsStatus?: 'owned' | 'licensed' | 'authorized_stream' | 'unknown';
  tags?: string[];
};

export type CreativeSignal = {
  sourceId: string;
  signal: 'liked' | 'played' | 'replayed' | 'skipped' | 'saved' | 'referenced' | 'created';
  note?: string;
  timestamp: string;
};

export type StorySeed = {
  title?: string;
  logline?: string;
  themes?: string[];
  characters?: string[];
  locations?: string[];
  tone?: string[];
  references?: ContentReference[];
};

export type ScreenplayDocument = {
  id: string;
  title: string;
  format: 'fountain' | 'fdx' | 'trelby';
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * DirectorOS may learn from the user's own library, scripts, notes, and
 * explicitly selected references. External copyrighted works are treated as
 * inspiration/reference metadata, not as material to reproduce.
 */
export function buildCreativeContext(
  references: ContentReference[],
  signals: CreativeSignal[],
  seed: StorySeed,
) {
  return {
    seed,
    references: references.filter(r => r.userOwned || r.kind === 'user_script' || r.kind === 'user_movie' || r.kind === 'user_note'),
    signals,
    externalReferences: references.filter(r => !r.userOwned && !['user_script', 'user_movie', 'user_note'].includes(r.kind)),
  };
}

export function createFountainDocument(title: string, logline = ''): ScreenplayDocument {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    format: 'fountain',
    content: `Title: ${title}\n\nLogline: ${logline}\n\nFADE IN:\n\n`,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}
