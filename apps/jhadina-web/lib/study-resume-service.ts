import type { StudyJob } from '@jhadina/director-core/study-job';
import { prepareStudyResume } from '@jhadina/director-core/study-resume-controller';
import type { StudyCheckpointStore } from '@jhadina/director-core/study-checkpoint-store';

export type StudyResumeService = {
  resume(job: StudyJob): Promise<StudyJob>;
};

export function createStudyResumeService(store: StudyCheckpointStore): StudyResumeService {
  return {
    resume(job) {
      return prepareStudyResume(job, store);
    },
  };
}
