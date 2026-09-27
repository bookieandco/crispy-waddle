import {describe,expect,it} from 'vitest';
import {reviseDirectorProductionProject,validateDirectorProductionProject,type DirectorProductionProject} from './production-project.js';

describe('Director production project',()=>{
  const base:DirectorProductionProject={
    id:'film:1',ownerUserId:'user:1',version:1,title:'Film',productionAssetRefs:[],wardrobePlanRefs:[],adapterRefs:[],performanceMasterRefs:[],creativeDirectiveRefs:[],status:'development',evidenceIds:['brief:1'],createdAt:'2026-09-27T00:00:00Z',updatedAt:'2026-09-27T00:00:00Z',authority:'DIRECTOR_PRODUCTION_PROJECT'
  };
  it('keeps the whole production as one versioned source-of-truth aggregate',()=>{
    expect(validateDirectorProductionProject(base)).toEqual([]);
    const next=reviseDirectorProductionProject(base,{processRecipeId:'recipe:1',storyBibleId:'story:1',status:'preproduction'},'recipe:1');
    expect(next.version).toBe(2);
    expect(next.processRecipeId).toBe('recipe:1');
  });
  it('will not call an incomplete project final',()=>{
    expect(validateDirectorProductionProject({...base,status:'final'})).toContain('DIRECTOR_PROJECT_FINAL_TIMELINE_REQUIRED');
  });
});
