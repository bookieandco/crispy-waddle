import type { SupabaseClient } from '@supabase/supabase-js';
import type { EditableTimeline } from '@jhadina/director-core/timeline-model';

type TimelineRow = {
  project_id: string;
  created_by_user_id: string;
  revision: number | string;
  timeline: EditableTimeline;
  last_mutation_id: string;
  created_at: string;
  updated_at: string;
};

export type DirectorWorkstationTimelineRecord = {
  projectId: string;
  createdByUserId: string;
  revision: number;
  timeline: EditableTimeline;
  lastMutationId: string;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: TimelineRow): DirectorWorkstationTimelineRecord {
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error('DIRECTOR_TIMELINE_REVISION_INVALID');
  }
  if (!row.timeline || row.timeline.projectId !== row.project_id) {
    throw new Error('DIRECTOR_TIMELINE_PROJECT_BINDING_MISMATCH');
  }
  return {
    projectId: row.project_id,
    createdByUserId: row.created_by_user_id,
    revision,
    timeline: row.timeline,
    lastMutationId: row.last_mutation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class DirectorWorkstationTimelineRepository {
  constructor(private readonly client: SupabaseClient) {}

  async load(projectId: string): Promise<DirectorWorkstationTimelineRecord | undefined> {
    const { data, error } = await this.client
      .from('director_workstation_timelines')
      .select('project_id,created_by_user_id,revision,timeline,last_mutation_id,created_at,updated_at')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) throw new Error(`DIRECTOR_TIMELINE_READ_FAILED:${error.message}`);
    return data ? mapRow(data as TimelineRow) : undefined;
  }

  async save(input: {
    projectId: string;
    userId: string;
    expectedRevision: number;
    mutationId: string;
    timeline: EditableTimeline;
    reason: string;
    now?: string;
  }): Promise<DirectorWorkstationTimelineRecord> {
    if (input.timeline.projectId !== input.projectId) {
      throw new Error('DIRECTOR_TIMELINE_PROJECT_BINDING_MISMATCH');
    }
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
      throw new Error('DIRECTOR_TIMELINE_EXPECTED_REVISION_INVALID');
    }

    const { data, error } = await this.client.rpc('save_director_workstation_timeline', {
      p_project_id: input.projectId,
      p_user_id: input.userId,
      p_expected_revision: input.expectedRevision,
      p_mutation_id: input.mutationId,
      p_timeline: input.timeline,
      p_reason: input.reason,
      p_now: input.now ?? new Date().toISOString(),
    });

    if (error) {
      const message = String(error.message ?? error);
      if (message.includes('DIRECTOR_TIMELINE_STALE_REVISION')) {
        throw new Error(message);
      }
      throw new Error(`DIRECTOR_TIMELINE_WRITE_FAILED:${message}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('DIRECTOR_TIMELINE_WRITE_RECEIPT_MISSING');
    return mapRow(row as TimelineRow);
  }
}
