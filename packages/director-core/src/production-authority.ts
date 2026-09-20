import type { CreativeGate, ProductionRun } from '../../shotlist-core/src/production.js';
import type { CreativeStage } from './creative-stage-graph.js';
import type { DirectorStoryboardLineage, DirectorStoryboardLineageResolver } from './storyboard-lineage-resolver.js';

type QueryResult = { data: unknown; error: { message: string } | null };
type Query = { select(columns: string): Query; eq(column: string, value: string): Query; maybeSingle(): Promise<QueryResult> };
export type ProductionAuthorityClient = { from(table: string): Query };

export interface DirectorProductionAuthorityRepository {
  getRun(runId: string, projectId: string): Promise<ProductionRun | null>;
  getGate(gateId: string, runId: string, projectId: string): Promise<CreativeGate | null>;
  getStage(stageId: string, projectId: string): Promise<CreativeStage | null>;
}

type RunRow = { id:string; project_id:string; status:ProductionRun['status']; created_at:string; updated_at:string; shot_ids:string[]; gate_ids:string[] };
type GateRow = { id:string; run_id:string; kind:CreativeGate['kind']; decision:CreativeGate['decision']; requested_at:string; decided_at:string|null; note:string|null };
type StageRow = { id:string; project_id:string; kind:CreativeStage['kind']; depends_on:string[]; status:CreativeStage['status']; input_artifact_ids:string[]; output_artifact_ids:string[]; version:number; approved_at:string|null; approved_by:string|null; last_invalidation:CreativeStage['lastInvalidation']|null };

export class SupabaseDirectorProductionAuthorityRepository implements DirectorProductionAuthorityRepository {
  constructor(private readonly client: ProductionAuthorityClient) {}
  async getRun(runId:string, projectId:string):Promise<ProductionRun|null> {
    const {data,error}=await this.client.from('director_production_runs').select('id,project_id,status,created_at,updated_at,shot_ids,gate_ids').eq('id',runId).eq('project_id',projectId).maybeSingle();
    if(error) throw new Error(`Failed to load production run: ${error.message}`);
    if(!data) return null; const r=data as RunRow;
    return {id:r.id,projectId:r.project_id,status:r.status,createdAt:r.created_at,updatedAt:r.updated_at,shotIds:[...r.shot_ids],gateIds:[...r.gate_ids]};
  }
  async getGate(gateId:string, runId:string, projectId:string):Promise<CreativeGate|null> {
    const {data,error}=await this.client.from('director_creative_gates').select('id,run_id,kind,decision,requested_at,decided_at,note').eq('id',gateId).eq('run_id',runId).eq('project_id',projectId).maybeSingle();
    if(error) throw new Error(`Failed to load creative gate: ${error.message}`);
    if(!data) return null; const g=data as GateRow;
    return {id:g.id,runId:g.run_id,kind:g.kind,decision:g.decision,requestedAt:g.requested_at,...(g.decided_at?{decidedAt:g.decided_at}:{}),...(g.note?{note:g.note}:{})};
  }
  async getStage(stageId:string, projectId:string):Promise<CreativeStage|null> {
    const {data,error}=await this.client.from('director_creative_stages').select('id,project_id,kind,depends_on,status,input_artifact_ids,output_artifact_ids,version,approved_at,approved_by,last_invalidation').eq('id',stageId).eq('project_id',projectId).maybeSingle();
    if(error) throw new Error(`Failed to load creative stage: ${error.message}`);
    if(!data) return null; const s=data as StageRow;
    return {id:s.id,projectId:s.project_id,kind:s.kind,dependsOn:[...s.depends_on],status:s.status,inputArtifactIds:[...s.input_artifact_ids],outputArtifactIds:[...s.output_artifact_ids],version:s.version,...(s.approved_at?{approvedAt:s.approved_at}:{}),...(s.approved_by?{approvedBy:s.approved_by}:{}),...(s.last_invalidation?{lastInvalidation:s.last_invalidation}:{})};
  }
}

export type DirectorGenerationAuthority = { run:ProductionRun; gate:CreativeGate; storyboardStage:CreativeStage; generationStage:CreativeStage; storyboardLineage:DirectorStoryboardLineage };

export class DirectorProductionAuthorityResolver {
  constructor(private readonly repository:DirectorProductionAuthorityRepository, private readonly storyboard:DirectorStoryboardLineageResolver) {}
  async resolve(input:{projectId:string;runId:string;gateId:string;storyboardBoardId:string}):Promise<DirectorGenerationAuthority> {
    const lineage=await this.storyboard.resolve(input.storyboardBoardId,input.projectId);
    const run=await this.repository.getRun(input.runId,input.projectId); if(!run) throw new Error('DIRECTOR_PRODUCTION_RUN_NOT_FOUND');
    const gate=await this.repository.getGate(input.gateId,input.runId,input.projectId); if(!gate) throw new Error('DIRECTOR_GENERATION_GATE_NOT_FOUND');
    if(!run.gateIds.includes(gate.id)||gate.runId!==run.id) throw new Error('DIRECTOR_GATE_RUN_MISMATCH');
    const storyboardStage=await this.repository.getStage(lineage.binding.stageIds.storyboard,input.projectId); if(!storyboardStage) throw new Error('DIRECTOR_STORYBOARD_STAGE_NOT_FOUND');
    const generationId=lineage.binding.stageIds.generation; if(!generationId) throw new Error('DIRECTOR_GENERATION_STAGE_NOT_BOUND');
    const generationStage=await this.repository.getStage(generationId,input.projectId); if(!generationStage) throw new Error('DIRECTOR_GENERATION_STAGE_NOT_FOUND');
    if(storyboardStage.kind!=='storyboard'||generationStage.kind!=='generation') throw new Error('DIRECTOR_STAGE_KIND_MISMATCH');
    return {run,gate,storyboardStage,generationStage,storyboardLineage:lineage};
  }
}
