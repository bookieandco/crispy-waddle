export type CinematicNoteKind = 'general' | 'shot' | 'camera' | 'edit' | 'sound' | 'lighting' | 'performance' | 'transition';

export type CinematicNote = {
  id: string;
  sourceId: string;
  title?: string;
  body: string;
  kind: CinematicNoteKind;
  startSeconds?: number;
  endSeconds?: number;
  frameUrl?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type CinematicNotebook = {
  id: string;
  title: string;
  notes: CinematicNote[];
};

export function createCinematicNotebook(id: string, title = 'Cinematic Notebook'): CinematicNotebook {
  return { id, title, notes: [] };
}

export function addCinematicNote(notebook: CinematicNotebook, note: Omit<CinematicNote, 'createdAt' | 'updatedAt'>, now = new Date().toISOString()): CinematicNotebook {
  return { ...notebook, notes: [...notebook.notes, { ...note, createdAt: now, updatedAt: now }] };
}

export function searchCinematicNotes(notebook: CinematicNotebook, query: string): CinematicNote[] {
  const q = query.trim().toLowerCase();
  if (!q) return notebook.notes;
  return notebook.notes.filter(note => [note.title ?? '', note.body, note.kind, ...note.tags].join(' ').toLowerCase().includes(q));
}
