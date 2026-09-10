import type { SupabaseClient } from '@supabase/supabase-js';
import type { StoryboardBoard, StoryboardSequence } from './storyboard-sequence.js';

export interface StoryboardRepository {
  getSequence(sequenceId: string, projectId: string): Promise<StoryboardSequence | null>;
  getBoard(boardId: string, projectId: string): Promise<StoryboardBoard | null>;
}

type SequenceRow = {
  id: string;
  project_id: string;
  scene_id: string;
  board_ids: string[];
  version: number;
  updated_at: string;
};

type BoardRow = {
  id: string;
  sequence_id: string;
  project_id: string;
  shot_id: string;
  ordinal: number;
  status: StoryboardBoard['status'];
  title: string | null;
  description: string | null;
  script_ref: string | null;
  reference_asset_ids: string[];
  continuity_anchor_ids: string[];
  continuity_locks: StoryboardBoard['continuityLocks'] | null;
  camera_language: string | null;
  framing: string | null;
  action: string | null;
  notes: string | null;
  cinematography: StoryboardBoard['cinematography'] | null;
  version: number;
  artifact_ids: string[];
  updated_at: string;
};

function mapSequence(row: SequenceRow): StoryboardSequence {
  return {
    id: row.id,
    projectId: row.project_id,
    sceneId: row.scene_id,
    boardIds: [...row.board_ids],
    version: row.version,
    updatedAt: row.updated_at,
  };
}

function mapBoard(row: BoardRow): StoryboardBoard {
  return {
    id: row.id,
    sequenceId: row.sequence_id,
    projectId: row.project_id,
    shotId: row.shot_id,
    order: row.ordinal,
    status: row.status,
    ...(row.title == null ? {} : { title: row.title }),
    ...(row.description == null ? {} : { description: row.description }),
    ...(row.script_ref == null ? {} : { scriptRef: row.script_ref }),
    referenceAssetIds: [...row.reference_asset_ids],
    continuityAnchorIds: [...row.continuity_anchor_ids],
    ...(row.continuity_locks == null ? {} : { continuityLocks: row.continuity_locks }),
    ...(row.camera_language == null ? {} : { cameraLanguage: row.camera_language }),
    ...(row.framing == null ? {} : { framing: row.framing }),
    ...(row.action == null ? {} : { action: row.action }),
    ...(row.notes == null ? {} : { notes: row.notes }),
    ...(row.cinematography == null ? {} : { cinematography: row.cinematography }),
    version: row.version,
    artifactIds: [...row.artifact_ids],
    updatedAt: row.updated_at,
  };
}

/**
 * Read-only persistence adapter. Project scoping is part of every lookup so a
 * caller cannot resolve another project's storyboard by guessing an ID.
 * Writes/versioning belong behind the governed storyboard mutation path.
 */
export class SupabaseStoryboardRepository implements StoryboardRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getSequence(sequenceId: string, projectId: string): Promise<StoryboardSequence | null> {
    const { data, error } = await this.client
      .from('director_storyboard_sequences')
      .select('id,project_id,scene_id,board_ids,version,updated_at')
      .eq('id', sequenceId)
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load storyboard sequence: ${error.message}`);
    return data ? mapSequence(data as SequenceRow) : null;
  }

  async getBoard(boardId: string, projectId: string): Promise<StoryboardBoard | null> {
    const { data, error } = await this.client
      .from('director_storyboard_boards')
      .select('id,sequence_id,project_id,shot_id,ordinal,status,title,description,script_ref,reference_asset_ids,continuity_anchor_ids,continuity_locks,camera_language,framing,action,notes,cinematography,version,artifact_ids,updated_at')
      .eq('id', boardId)
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load storyboard board: ${error.message}`);
    return data ? mapBoard(data as BoardRow) : null;
  }
}
