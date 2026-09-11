import type { StoryboardBoard, StoryboardSequence } from './storyboard-sequence.js';
import type { StoryboardStageBinding } from './storyboard-stage-binding.js';

type SupabaseQueryResult = { data: unknown; error: { message: string } | null };
type SupabaseQuery = {
  select(columns: string): SupabaseQuery;
  eq(column: string, value: string): SupabaseQuery;
  order(column: string, options: { ascending: boolean }): SupabaseQuery;
  limit(count: number): SupabaseQuery;
  maybeSingle(): Promise<SupabaseQueryResult>;
};

/** Minimal structural query surface; keeps Director Core independent of a Supabase SDK package. */
export type SupabaseStoryboardClient = { from(table: string): SupabaseQuery };

export interface StoryboardRepository {
  getSequence(sequenceId: string, projectId: string): Promise<StoryboardSequence | null>;
  getBoard(boardId: string, projectId: string): Promise<StoryboardBoard | null>;
}

export interface StoryboardBindingRepository extends StoryboardRepository {
  getBinding(boardId: string, projectId: string): Promise<StoryboardStageBinding | null>;
}

type SequenceRow = { id: string; project_id: string; scene_id: string; board_ids: string[]; version: number; updated_at: string };
type BoardRow = {
  id: string; sequence_id: string; project_id: string; shot_id: string; ordinal: number;
  status: StoryboardBoard['status']; title: string | null; description: string | null;
  script_ref: string | null; reference_asset_ids: string[]; continuity_anchor_ids: string[];
  continuity_locks: StoryboardBoard['continuityLocks'] | null; camera_language: string | null;
  framing: string | null; action: string | null; notes: string | null;
  cinematography: StoryboardBoard['cinematography'] | null; version: number;
  artifact_ids: string[]; updated_at: string;
};
type BindingRow = {
  id: string; project_id: string; storyboard_board_id: string; storyboard_stage_id: string;
  shotlist_stage_id: string; previs_stage_id: string | null; generation_stage_id: string | null;
  edit_stage_id: string | null; review_stage_id: string | null; version: number;
};

function mapSequence(row: SequenceRow): StoryboardSequence {
  return { id: row.id, projectId: row.project_id, sceneId: row.scene_id, boardIds: [...row.board_ids], version: row.version, updatedAt: row.updated_at };
}

function mapBoard(row: BoardRow): StoryboardBoard {
  return {
    id: row.id, sequenceId: row.sequence_id, projectId: row.project_id, shotId: row.shot_id,
    order: row.ordinal, status: row.status,
    ...(row.title == null ? {} : { title: row.title }),
    ...(row.description == null ? {} : { description: row.description }),
    ...(row.script_ref == null ? {} : { scriptRef: row.script_ref }),
    referenceAssetIds: [...row.reference_asset_ids], continuityAnchorIds: [...row.continuity_anchor_ids],
    ...(row.continuity_locks == null ? {} : { continuityLocks: row.continuity_locks }),
    ...(row.camera_language == null ? {} : { cameraLanguage: row.camera_language }),
    ...(row.framing == null ? {} : { framing: row.framing }),
    ...(row.action == null ? {} : { action: row.action }),
    ...(row.notes == null ? {} : { notes: row.notes }),
    ...(row.cinematography == null ? {} : { cinematography: row.cinematography }),
    version: row.version, artifactIds: [...row.artifact_ids], updatedAt: row.updated_at,
  };
}

function mapBinding(row: BindingRow): StoryboardStageBinding {
  return {
    projectId: row.project_id,
    storyboardBoardId: row.storyboard_board_id,
    stageIds: {
      storyboard: row.storyboard_stage_id,
      shotlist: row.shotlist_stage_id,
      ...(row.previs_stage_id == null ? {} : { previs: row.previs_stage_id }),
      ...(row.generation_stage_id == null ? {} : { generation: row.generation_stage_id }),
      ...(row.edit_stage_id == null ? {} : { edit: row.edit_stage_id }),
      ...(row.review_stage_id == null ? {} : { review: row.review_stage_id }),
    },
    version: row.version,
  };
}

/** Read-only persistence adapter. Every lookup is project-scoped. */
export class SupabaseStoryboardRepository implements StoryboardBindingRepository {
  constructor(private readonly client: SupabaseStoryboardClient) {}

  async getSequence(sequenceId: string, projectId: string): Promise<StoryboardSequence | null> {
    const { data, error } = await this.client.from('director_storyboard_sequences')
      .select('id,project_id,scene_id,board_ids,version,updated_at').eq('id', sequenceId).eq('project_id', projectId).maybeSingle();
    if (error) throw new Error(`Failed to load storyboard sequence: ${error.message}`);
    return data ? mapSequence(data as SequenceRow) : null;
  }

  async getBoard(boardId: string, projectId: string): Promise<StoryboardBoard | null> {
    const { data, error } = await this.client.from('director_storyboard_boards')
      .select('id,sequence_id,project_id,shot_id,ordinal,status,title,description,script_ref,reference_asset_ids,continuity_anchor_ids,continuity_locks,camera_language,framing,action,notes,cinematography,version,artifact_ids,updated_at')
      .eq('id', boardId).eq('project_id', projectId).maybeSingle();
    if (error) throw new Error(`Failed to load storyboard board: ${error.message}`);
    return data ? mapBoard(data as BoardRow) : null;
  }

  async getBinding(boardId: string, projectId: string): Promise<StoryboardStageBinding | null> {
    const { data, error } = await this.client.from('director_storyboard_stage_bindings')
      .select('id,project_id,storyboard_board_id,storyboard_stage_id,shotlist_stage_id,previs_stage_id,generation_stage_id,edit_stage_id,review_stage_id,version')
      .eq('storyboard_board_id', boardId).eq('project_id', projectId).order('version', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(`Failed to load storyboard stage binding: ${error.message}`);
    return data ? mapBinding(data as BindingRow) : null;
  }
}
