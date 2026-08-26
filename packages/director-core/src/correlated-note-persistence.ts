import { addCinematicNote, type CinematicNotebook, type CinematicNoteKind } from './cinematic-notebook.js';
import type { CorrelatedStudyNote } from './correlated-study-note.js';

export type CorrelatedNotePersistence = {
  add(notebook: CinematicNotebook, note: CorrelatedStudyNote, kind?: CinematicNoteKind): CinematicNotebook;
};

export function createCorrelatedNotePersistence(): CorrelatedNotePersistence {
  return {
    add(notebook, note, kind = 'general') {
      const id = `study-note:${note.startSeconds.toFixed(3)}:${note.endSeconds.toFixed(3)}`;
      return addCinematicNote(notebook, {
        id,
        sourceId: 'autonomous-study',
        title: `Study moment ${note.startSeconds.toFixed(1)}s`,
        body: note.summary,
        kind,
        startSeconds: note.startSeconds,
        endSeconds: note.endSeconds,
        tags: ['autonomous-study', `evidence:${note.evidenceCount}`],
      });
    },
  };
}
