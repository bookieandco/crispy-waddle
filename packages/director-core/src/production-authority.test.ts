import { describe, expect, it } from 'vitest';
import { DirectorProductionAuthorityResolver, type DirectorProductionAuthorityRepository } from './production-authority';
import type { DirectorStoryboardLineageResolver } from './storyboard-lineage-resolver';

const run={id:'run',projectId:'p',status:'awaiting_approval' as const,createdAt:'t',updatedAt:'t',shotIds:['shot'],gateIds:['gate']};
const gate={id:'gate',runId:'run',kind:'generation' as const,decision:'approved' as const,requestedAt:'t'};
const storyboard={id:'sb',projectId:'p',kind:'storyboard' as const,dependsOn:[],status:'approved' as const,inputArtifactIds:[],outputArtifactIds:[],version:1};
const generation={id:'gen',projectId:'p',kind:'generation' as const,dependsOn:['sb'],status:'ready' as const,inputArtifactIds:[],outputArtifactIds:[],version:1};
const lineage={sequence:{id:'seq',projectId:'p',sceneId:'scene',boardIds:['board'],version:1,updatedAt:'t'},board:{id:'board',sequenceId:'seq',projectId:'p',shotId:'shot',order:1,status:'approved' as const,referenceAssetIds:[],continuityAnchorIds:[],version:1,artifactIds:[],updatedAt:'t'},binding:{projectId:'p',storyboardBoardId:'board',stageIds:{storyboard:'sb',shotlist:'sl',generation:'gen'},version:1}};
function resolver(repo?:Partial<DirectorProductionAuthorityRepository>){
 const r:DirectorProductionAuthorityRepository={getRun:async()=>run,getGate:async()=>gate,getStage:async(id)=>id==='sb'?storyboard:generation,...repo};
 const s={resolve:async(boardId:string,projectId:string)=>{if(boardId!=='board'||projectId!=='p')throw new Error('lineage scope');return lineage;}} as unknown as DirectorStoryboardLineageResolver;
 return new DirectorProductionAuthorityResolver(r,s);
}
describe('DirectorProductionAuthorityResolver',()=>{
 it('reconstructs generation authority from canonical stores',async()=>{const a=await resolver().resolve({projectId:'p',runId:'run',gateId:'gate',storyboardBoardId:'board'});expect(a.generationStage.id).toBe('gen');expect(a.gate.decision).toBe('approved');});
 it('rejects a missing project-scoped run',async()=>{await expect(resolver({getRun:async()=>null}).resolve({projectId:'p',runId:'foreign',gateId:'gate',storyboardBoardId:'board'})).rejects.toThrow('DIRECTOR_PRODUCTION_RUN_NOT_FOUND');});
 it('rejects a gate not registered by the canonical run',async()=>{await expect(resolver({getGate:async()=>({...gate,id:'forged'})}).resolve({projectId:'p',runId:'run',gateId:'forged',storyboardBoardId:'board'})).rejects.toThrow('DIRECTOR_GATE_RUN_MISMATCH');});
 it('rejects missing canonical generation binding',async()=>{const bad={...lineage,binding:{...lineage.binding,stageIds:{storyboard:'sb',shotlist:'sl'}}};const s={resolve:async()=>bad} as unknown as DirectorStoryboardLineageResolver;const r:DirectorProductionAuthorityRepository={getRun:async()=>run,getGate:async()=>gate,getStage:async()=>storyboard};await expect(new DirectorProductionAuthorityResolver(r,s).resolve({projectId:'p',runId:'run',gateId:'gate',storyboardBoardId:'board'})).rejects.toThrow('DIRECTOR_GENERATION_STAGE_NOT_BOUND');});
});
