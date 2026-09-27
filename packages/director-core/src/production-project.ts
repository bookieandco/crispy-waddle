export interface DirectorProductionProject {
  id: string;
  ownerUserId: string;
  version: number;
  title: string;
  processRecipeId?: string;
  scriptAssetId?: string;
  storyBibleId?: string;
  castBibleId?: string;
  voiceBibleId?: string;
  audioBibleId?: string;
  worldStateRef?: string;
  productionAssetRefs: readonly string[];
  wardrobePlanRefs: readonly string[];
  adapterRefs: readonly string[];
  performanceMasterRefs: readonly string[];
  rehearsalPlanRefs?: readonly string[];
  rehearsalApprovedTakeRefs?: readonly string[];
  creativeDirectiveRefs: readonly string[];
  timelineVersionId?: string;
  finalMasterAssetId?: string;
  status: 'development' | 'preproduction' | 'production' | 'post' | 'review' | 'final';
  evidenceIds: readonly string[];
  createdAt: string;
  updatedAt: string;
  authority: 'DIRECTOR_PRODUCTION_PROJECT';
}

export function validateDirectorProductionProject(project: DirectorProductionProject): readonly string[] {
  const reasons:string[]=[];
  if(!project.id.trim()||!project.ownerUserId.trim()||!project.title.trim()) reasons.push('DIRECTOR_PROJECT_IDENTITY_REQUIRED');
  if(!Number.isInteger(project.version)||project.version<1) reasons.push('DIRECTOR_PROJECT_VERSION_INVALID');
  if(!project.evidenceIds.length) reasons.push('DIRECTOR_PROJECT_EVIDENCE_REQUIRED');
  if(!Number.isFinite(Date.parse(project.createdAt))||!Number.isFinite(Date.parse(project.updatedAt))) reasons.push('DIRECTOR_PROJECT_TIME_INVALID');
  if(project.status==='final'){
    if(!project.timelineVersionId) reasons.push('DIRECTOR_PROJECT_FINAL_TIMELINE_REQUIRED');
    if(!project.finalMasterAssetId) reasons.push('DIRECTOR_PROJECT_FINAL_MASTER_REQUIRED');
    if(!project.castBibleId||!project.voiceBibleId||!project.audioBibleId) reasons.push('DIRECTOR_PROJECT_FINAL_BIBLES_REQUIRED');
  }
  return Object.freeze([...new Set(reasons)]);
}

export function reviseDirectorProductionProject(
  project: DirectorProductionProject,
  patch: Partial<Omit<DirectorProductionProject,'id'|'ownerUserId'|'authority'|'version'|'createdAt'>>,
  evidenceId: string,
): DirectorProductionProject {
  if(!evidenceId.trim()) throw new Error('DIRECTOR_PROJECT_REVISION_EVIDENCE_REQUIRED');
  const next:DirectorProductionProject={
    ...project,
    ...patch,
    version:project.version+1,
    evidenceIds:Object.freeze([...new Set([...project.evidenceIds,evidenceId])]),
    updatedAt:new Date().toISOString(),
    authority:'DIRECTOR_PRODUCTION_PROJECT',
  };
  const reasons=validateDirectorProductionProject(next);
  if(reasons.length) throw new Error(`DIRECTOR_PROJECT_INVALID: ${reasons.join(', ')}`);
  return Object.freeze(next);
}
