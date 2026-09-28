import type { SupabaseClient } from '@supabase/supabase-js';
import {
  evaluateDirectorProductionFinalEvidence,
  evaluateDirectorProductionFinalMatrix,
  type DirectorProductionFinalDecision,
  type DirectorProductionFinalEvidence,
  type DirectorProductionFinalMatrixDecision,
  type DirectorProductionFixtureKind,
} from '@jhadina/director-core/production-quality-certification';
import type {
  CreativeDirective,
  ProductionAssetPackage,
  WorldStateGraph,
} from '@jhadina/director-core/production-foundry';

export class DirectorProductionFinalRepository {
  constructor(private readonly client: SupabaseClient) {}

  async persistAssetPackage(input:{
    ownerUserId:string;
    projectId:string;
    package:ProductionAssetPackage;
  }):Promise<void>{
    const pkg=input.package;
    const {error}=await this.client.from('director_production_asset_packages').upsert({
      id:pkg.id,
      project_id:input.projectId,
      owner_user_id:input.ownerUserId,
      version:pkg.version,
      kind:pkg.kind,
      source_fingerprint:pkg.sourceFingerprint,
      package:pkg,
      evidence_ids:pkg.canonicalReferences.flatMap((reference)=>reference.evidenceIds),
      updated_at:new Date().toISOString(),
    },{onConflict:'id,version'});
    if(error) throw error;
  }

  async persistWorldState(input:{
    ownerUserId:string;
    graph:WorldStateGraph;
    evidenceIds:readonly string[];
  }):Promise<void>{
    if(!input.evidenceIds.length) throw new Error('DIRECTOR_WORLD_STATE_PERSISTENCE_EVIDENCE_REQUIRED');
    const {error}=await this.client.from('director_world_state_versions').upsert({
      id:input.graph.id,
      project_id:input.graph.projectId,
      owner_user_id:input.ownerUserId,
      version:input.graph.version,
      world_kind:input.graph.kind,
      state:input.graph,
      evidence_ids:[...input.evidenceIds],
    },{onConflict:'id,version'});
    if(error) throw error;
  }

  async persistCreativeDirective(input:{
    ownerUserId:string;
    directive:CreativeDirective;
  }):Promise<void>{
    const directive=input.directive;
    if(!directive.evidenceIds.length) throw new Error('DIRECTOR_CREATIVE_DIRECTIVE_EVIDENCE_REQUIRED');
    const {error}=await this.client.from('director_creative_directives').upsert({
      id:directive.id,
      project_id:directive.projectId,
      owner_user_id:input.ownerUserId,
      scope:directive.scope,
      scope_ref:directive.scopeRef,
      key:directive.key,
      mode:directive.mode,
      value:directive.value??null,
      created_by:directive.createdBy,
      evidence_ids:[...directive.evidenceIds],
      created_at:directive.createdAt,
    },{onConflict:'id'});
    if(error) throw error;
  }

  async persistQualityEvidence(input:{
    ownerUserId:string;
    runId:string;
    evidence:DirectorProductionFinalEvidence;
  }):Promise<DirectorProductionFinalDecision>{
    const decision=evaluateDirectorProductionFinalEvidence(input.evidence);
    const {error}=await this.client.from('director_production_quality_runs').upsert({
      id:input.runId,
      owner_user_id:input.ownerUserId,
      project_id:input.evidence.projectId,
      fixture_kind:input.evidence.fixtureKind,
      status:decision.admissible?'passed':'blocked',
      provider_id:input.evidence.artifact.providerId,
      model_id:input.evidence.artifact.modelId,
      final_master_asset_id:input.evidence.finalMasterAssetId,
      evidence:input.evidence,
      reasons:[...decision.reasons],
      quality_claim:decision.admissible,
      updated_at:new Date().toISOString(),
    },{onConflict:'id'});
    if(error) throw error;
    return decision;
  }

  async loadLatestPassedFixture(
    ownerUserId:string,
    fixtureKind:DirectorProductionFixtureKind,
    projectId?:string,
  ):Promise<DirectorProductionFinalEvidence|undefined>{
    let query=this.client
      .from('director_production_quality_runs')
      .select('evidence')
      .eq('owner_user_id',ownerUserId)
      .eq('fixture_kind',fixtureKind)
      .eq('status','passed')
      .eq('quality_claim',true);
    if(projectId?.trim()) query=query.eq('project_id',projectId.trim());
    const {data,error}=await query
      .order('updated_at',{ascending:false})
      .limit(1)
      .maybeSingle();
    if(error) throw error;
    if(!data?.evidence) return undefined;
    return data.evidence as DirectorProductionFinalEvidence;
  }

  async evaluatePersistedFinalMatrix(
    ownerUserId:string,
    expectedProjects?:Readonly<Partial<Record<DirectorProductionFixtureKind,string>>>,
  ):Promise<DirectorProductionFinalMatrixDecision>{
    const kinds:readonly DirectorProductionFixtureKind[]=[
      'commercial-30s',
      'branded-short-8-13m',
      'episode-22-30m',
      'feature-55-70m',
    ];
    const evidence:DirectorProductionFinalEvidence[]=[];
    for(const kind of kinds){
      const item=await this.loadLatestPassedFixture(ownerUserId,kind,expectedProjects?.[kind]);
      if(item) evidence.push(item);
    }
    return evaluateDirectorProductionFinalMatrix(evidence);
  }
}
