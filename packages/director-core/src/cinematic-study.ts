export type StudyNoteType = 'shot' | 'edit' | 'camera' | 'sound' | 'lighting' | 'performance' | 'transition' | 'general';

export type CinematicStudyNote = {
  id: string;
  sourceId: string;
  time?: { startSeconds: number; endSeconds: number };
  type: StudyNoteType;
  observation: string;
  directorNote?: string;
  tags: string[];
  createdAt: string;
};

export type CinematicPattern = {
  id: string;
  name: string;
  description: string;
  supportingNoteIds: string[];
  confidence?: number;
  tags: string[];
};

export type CinematicStudyNotebook = {
  notes: CinematicStudyNote[];
  patterns: CinematicPattern[];
};

export function addStudyNote(
  notebook: CinematicStudyNotebook,
  note: CinematicStudyNote,
): CinematicStudyNotebook {
  if (notebook.notes.some(existing => existing.id === note.id)) {
    throw new Error(`Cinematic study note already exists: ${note.id}`);
  }
  return { ...notebook, notes: [...notebook.notes, note] };
}

export function addCinematicPattern(
  notebook: CinematicStudyNotebook,
  pattern: CinematicPattern,
): CinematicStudyNotebook {
  if (notebook.patterns.some(existing => existing.id === pattern.id)) {
    throw new Error(`Cinematic pattern already exists: ${pattern.id}`);
  }
  return { ...notebook, patterns: [...notebook.patterns, pattern] };
}

export function searchCinematicStudy(
  notebook: CinematicStudyNotebook,
  query: string,
): { notes: CinematicStudyNote[]; patterns: CinematicPattern[] } {
  const needle = query.trim().toLowerCase();
  if (!needle) return notebook;
  const notes = notebook.notes.filter(note =>
    [note.observation, note.directorNote ?? '', note.type, ...note.tags]
      .join(' ')
      .toLowerCase()
      .includes(needle),
  );
  const patterns = notebook.patterns.filter(pattern =>
    [pattern.name, pattern.description, ...pattern.tags].join(' ').toLowerCase().includes(needle),
  );
  return { notes, patterns };
}
