import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudyCheckpoint } from '@jhadina/director-core/study-resume-state';
import type { StudyJob } from '@jhadina/director-core/study-job';
import type { StudyPersistence } from '@jhadina/director-core/study-persistence';

function toJob(row: any): StudyJob {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    autonomous: row.autonomous,
    shareWithJhadina: row.share_with_jhadina,
    status: row.status,
    lastTimeSeconds: Number(row.last_time_seconds),
    observationsSeen: row.observations_seen,
    notesCreated: row.notes_created,
    learningCandidatesCreated: row.learning_candidates_created,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    error: row.error ?? undefined,
  };
}

function toCheckpoint(row: any): StudyCheckpoint {
  return {
    studyId: row.study_id,
    timeSeconds: Number(row.time_seconds),
    observationsSeen: row.observations_seen,
    notesCreated: row.notes_created,
    learningCandidatesCreated: row.learning_candidates_created,
    capturedAt: row.created_at,
  };
}

export function createSupabaseStudyPersistence(client: SupabaseClient): StudyPersistence {
  return {
    jobs: {
      async get(id) {
        const { data, error } = await client.from('director_studies').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return data ? toJob(data) : undefined;
      },
      async save(job) {
        const { error } = await client.from('director_studies').upsert({
          id: job.id,
          source_url: job.sourceUrl,
          autonomous: job.autonomous,
          share_with_jhadina: job.shareWithJhadina,
          status: job.status,
          last_time_seconds: job.lastTimeSeconds,
          observations_seen: job.observationsSeen,
          notes_created: job.notesCreated,
          learning_candidates_created: job.learningCandidatesCreated,
          started_at: job.startedAt ?? null,
          completed_at: job.completedAt ?? null,
          error: job.error ?? null,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      },
    },
    checkpoints: {
      async save(checkpoint) {
        const { error } = await client.from('director_study_checkpoints').insert({
          study_id: checkpoint.studyId,
          time_seconds: checkpoint.timeSeconds,
          observations_seen: checkpoint.observationsSeen,
          notes_created: checkpoint.notesCreated,
          learning_candidates_created: checkpoint.learningCandidatesCreated,
          created_at: checkpoint.capturedAt,
        });
        if (error) throw error;
      },
      async latest(studyId) {
        const { data, error } = await client.from('director_study_checkpoints').select('*').eq('study_id', studyId).order('time_seconds', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        return data ? toCheckpoint(data) : undefined;
      },
    },
  };
}
