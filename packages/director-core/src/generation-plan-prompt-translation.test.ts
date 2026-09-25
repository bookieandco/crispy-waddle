import {describe,expect,it,vi} from 'vitest';
import {GenerationPlanAdapter} from './generation-plan-adapter';
import {GenerationRegistry} from './generation-registry';
import {GenerationService} from './generation-service';
import type {GenerationProvider,GenerationRequest,GenerationResult} from './generation-provider';
import type {ModelPromptProfile} from './model-prompt-translation';
import type {CreativeGate,ProductionRun} from '../../shotlist-core/src/production.js';
import type {CreativeStage} from './creative-stage-graph.js';
import type {DirectorStoryboardLineage,DirectorStoryboardLineageResolver} from './storyboard-lineage-resolver';

const run:ProductionRun={id:'run',projectId:'p',status:'awaiting_approval',createdAt:'now',updatedAt:'now',shotIds:['shot'],gateIds:['gate']};
const gate:CreativeGate={id:'gate',runId:'run',kind:'generation',decision:'approved',requestedAt:'now'};
const storyboardStage:CreativeStage={id:'story',projectId:'p',kind:'storyboard',dependsOn:[],status:'approved',inputArtifactIds:[],outputArtifactIds:[],version:1};
const generationStage:CreativeStage={id:'gen',projectId:'p',kind:'generation',dependsOn:['story'],status:'ready',inputArtifactIds:[],outputArtifactIds:[],version:1};
const lineage:DirectorStoryboardLineage={
  sequence:{id:'seq',projectId:'p',sceneId:'scene',boardIds:['board'],version:1,updatedAt:'now'},
  board:{id:'board',sequenceId:'seq',projectId:'p',shotId:'shot',order:1,status:'approved',referenceAssetIds:[],continuityAnchorIds:[],version:1,artifactIds:[],updatedAt:'now'},
  binding:{projectId:'p',storyboardBoardId:'board',stageIds:{storyboard:'story',shotlist:'shots',generation:'gen'},version:1},
};
const profile:ModelPromptProfile={
  id:'profile:model-v1',providerId:'provider',modelId:'video-model',modelVersion:'1',
  documentationSources:[{
    id:'docs:official',providerId:'provider',modelId:'video-model',modelVersion:'1',kind:'official-prompt-guide',
    uri:'https://provider.example/prompt-guide',sha256:'sha-docs',capturedAt:'2026-09-25T00:00:00Z',evidenceIds:['docs:fetch'],
  }],
  evidenceIds:['profile:review'],authority:'PROVIDER_PROMPT_PROFILE',
};

function build(profileOverride:ModelPromptProfile=profile){
  const submitted:{requests:GenerationRequest[]}={requests:[]};
  const registry=new GenerationRegistry();
  registry.registerProvider({id:'provider',name:'Provider',kind:'api',capabilities:['text-to-video'],models:['video-model'],health:'healthy'});
  registry.registerModel({id:'video-model',providerId:'provider',name:'Video Model',version:'1',modalities:['video'],capabilities:['text-to-video']});
  const provider:GenerationProvider={
    descriptor:registry.getProvider('provider')!,
    async submit(input){submitted.requests.push(input);return{requestId:input.requestId,providerId:'provider',status:'queued',assetIds:[],providerJobId:'job'};},
    async status(providerJobId):Promise<GenerationResult>{return{requestId:providerJobId,providerId:'provider',status:'completed',assetIds:[]};},
    async cancel(){},
  };
  const resolver={resolve:async()=>lineage} as unknown as DirectorStoryboardLineageResolver;
  const promptProfileResolver={resolve:vi.fn(async(id:string)=>id===profileOverride.id?profileOverride:undefined)};
  const translator={translate:vi.fn(async(input:any,p:any)=>({
    profileId:p.id,providerId:p.providerId,modelId:p.modelId,modelVersion:p.modelVersion,
    translatedPrompt:`MODEL-DOC OPTIMIZED\n${input.canonicalPrompt}`,
    canonicalPromptSha256:'sha-canonical',
    documentationSourceIds:['docs:official'],
    evidenceIds:['translation:receipt'],
    authority:'PROVIDER_PROMPT_TRANSLATION' as const,
  }))};
  const adapter=new GenerationPlanAdapter(
    new GenerationService(registry,new Map([['provider',provider]])),
    registry,resolver,undefined,undefined,promptProfileResolver,translator,
  );
  return{submitted,adapter,promptProfileResolver,translator};
}

function request(){
  return{takeId:'take',projectId:'p',sceneId:'scene',storyboardBoardId:'board',prompt:'Start close on her face, pull back, orbit to reveal what she sees.',locked:['camera','performance'] as const};
}
function gateInput(){return{run,gate,generationStage,storyboardStage};}

describe('generation plan prompt translation',()=>{
  it('keeps Director intent canonical while sending a documentation-optimized provider prompt',async()=>{
    const{submitted,adapter,translator}=build();
    await adapter.submitTake(request(),{
      modelId:'video-model',modality:'video',promptProfileId:profile.id,
      promptRefinementFeedback:['Less melodramatic; keep the emotion subdued and cinematic.'],
    },gateInput());
    expect(submitted.requests[0]?.prompt).toContain('MODEL-DOC OPTIMIZED');
    expect(submitted.requests[0]?.parameters).toMatchObject({
      canonicalPrompt:expect.stringContaining('Start close on her face'),
      promptRefinementFeedback:['Less melodramatic; keep the emotion subdued and cinematic.'],
      promptTranslation:{
        profileId:profile.id,modelId:'video-model',modelVersion:'1',
        documentationSourceIds:['docs:official'],evidenceIds:['translation:receipt'],
      },
    });
    expect(translator.translate).toHaveBeenCalledWith(expect.objectContaining({
      canonicalPrompt:expect.stringContaining('Start close on her face'),
      creativeFeedback:['Less melodramatic; keep the emotion subdued and cinematic.'],
    }),profile);
  });

  it('fails closed when a prompt profile targets another model version',async()=>{
    const{adapter}=build({...profile,modelVersion:'2',documentationSources:[{...profile.documentationSources[0]!,modelVersion:'2'}]});
    await expect(adapter.submitTake(request(),{
      modelId:'video-model',modality:'video',promptProfileId:profile.id,
    },gateInput())).rejects.toThrow('DIRECTOR_PROMPT_PROFILE_MODEL_MISMATCH');
  });

  it('does not accept translator refinement feedback without a governed prompt profile',async()=>{
    const{adapter}=build();
    await expect(adapter.submitTake(request(),{
      modelId:'video-model',modality:'video',promptRefinementFeedback:['Make it less dramatic.'],
    },gateInput())).rejects.toThrow('DIRECTOR_PROMPT_PROFILE_REQUIRED_FOR_REFINEMENT');
  });
});
