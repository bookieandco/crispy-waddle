import type { CinematicNotebook, CinematicNote } from './cinematic-notebook.js';
import type { StudyJob } from './study-job.js';

export type LiveStudyNotebookView = {
  studyId: string;
  status: StudyJob['status'];
  positionSeconds: number;
  observationsSeen: number;
  notesCreated: number;
  learningCandidatesCreated: number;
  notes: CinematicNote[];
};

export function createLiveStudyNotebookView(job: StudyJob, notebook: CinematicNotebook): LiveStudyNotebookView {
  return {
    studyId: job.id,
    status: job.status,
    positionSeconds: job.lastTimeSeconds,
    observationsSeen: job.observationsSeen,
    notesCreated: job.notesCreated,
    learningCandidatesCreated: job.learningCandidatesCreated,
    notes: [...notebook.notes].sort((a, b) => (a.startSeconds ?? 0) - (b.startSeconds ?? 0)),
  };
}
