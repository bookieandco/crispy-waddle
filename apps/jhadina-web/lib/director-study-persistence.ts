import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudyCheckpoint } from '@jhadina/director-core/study-resume-state';
import type { StudyJob } from '@jhadina/director-core/study-job';
import type { StudyPersistence } from '@jhadina/director-core/study-persistence';

type StudyRow = {
  id: string;
  source_url: string;
  autonomous: boolean;
  share_with_jhadina: boolean;
  status: StudyJob['status'];
  last_time_seconds: number;
  observations_seen: number;
  notes_created: number;
  learning_candidates_created: number;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
};

type CheckpointRow = {
  id: string;
  study_id: string;
  time_seconds: number;
  observations_seen: number;
  notes_created: number;
  learning_candidates_created: number;
  created_at: string;
};

function toJob(row: StudyRow): StudyJob {
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

function toCheckpoint(row: CheckpointRow): StudyCheckpoint {
  return {
    id: row.id,
    studyId: row.study_id,
    timeSeconds: Number(row.time_seconds),
    observationsSeen: row.observations_seen,
    notesCreated: row.notes_created,
    learningCandidatesCreated: row.learning_candidates_created,
    createdAt: row.created_at,
  };
}

export function createSupabaseStudyPersistence(supabase: SupabaseClient): StudyPersistence {
  return {
    jobs: {
      async get(id) {
        const { data, error } = await supabase.from('director_studies').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return data ? toJob(data as StudyRow) : undefined;
      },
      async save(job) {
        const { error } = await supabase.from('director_studies').upsert({
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
        const { error } = await supabase.from('director_study_checkpoints').insert({
          id: checkpoint.id,
          study_id: checkpoint.studyId,
          time_seconds: checkpoint.timeSeconds,
          observations_seen: checkpoint.observationsSeen,
          notes_created: checkpoint.notesCreated,
          learning_candidates_created: checkpoint.learningCandidatesCreated,
          created_at: checkpoint.createdAt,
        });
        if (error) throw error;
      },
      async latest(studyId) {
        const { data, error } = await supabase
          .from('director_study_checkpoints')
          .select('*')
          .eq('study_id', studyId)
          .order('time_seconds', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data ? toCheckpoint(data as CheckpointRow) : undefined;
      },
    },
  };
}
