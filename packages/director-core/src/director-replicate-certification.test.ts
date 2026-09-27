import { describe, expect, it } from 'vitest';
import {
  compileProcessRecipe,
  compileRecipeToCreativeStageGraph,
  detectProcessReplicationIntent,
  improveProcessRecipe,
  type DirectorProcessObservation,
} from './process-replication';
import { deriveDirectorNativeImprovements } from './process-observation';
import {
  evaluateRehearsalTake,
  rehearsalGraduationReceipt,
  type RehearsalPlan,
  type RehearsalTake,
} from './rehearsal-loop';
import {
  validateDirectorProductionProject,
  type DirectorProductionProject,
} from './production-project';

const profiles = [
  { id:'ad-30s', command:'replicate this process better as a 30 second ad', duration:30, targetKind:'ad' as const },
  { id:'branded-film-10m', command:'replicate this workflow better as a 10 minute branded film', duration:600, targetKind:'film' as const },
  { id:'episode-25m', command:'replicate this tutorial better as a 25 minute episode', duration:1500, targetKind:'episode' as const },
  { id:'movie-60m', command:'replicate this method better as a 60 minute movie', duration:3600, targetKind:'film' as const },
] as const;

function observations(profileId:string):DirectorProcessObservation[]{
  const sourceId=`source:${profileId}`;
  const row=(id:string,order:number,kind:DirectorProcessObservation['kind'],purpose:string,operation:string,extra:Partial<DirectorProcessObservation>={}):DirectorProcessObservation=>({
    id:`${profileId}:${id}`,
    sourceId,
    sourceUrl:'https://example.com/reference',
    order,
    kind,
    purpose,
    operation,
    requiredCapabilities:[],
    inputs:order?[`${profileId}:out:${order-1}`]:['brief'],
    outputs:[`${profileId}:out:${order}`],
    qcChecks:[],
    failureModes:[],
    evidenceIds:[`evidence:${profileId}:${id}`],
    ...extra,
  });
  return [
    row('research',0,'research','understand audience and objective','research source and audience'),
    row('concept',1,'concept','define creative promise','define concept'),
    row('script',2,'script','author coherent story','write script and beat map'),
    row('character',3,'character','preserve cast identity','reroll until the same face looks close',{failureModes:['identity drift']}),
    row('wardrobe',4,'wardrobe','preserve clothing and products','keep the same wardrobe and product logos',{failureModes:['garment drift','product drift']}),
    row('storyboard',5,'storyboard','plan visual coverage','storyboard scenes and coverage'),
    row('previs',6,'previs','prove timing and blocking cheaply','build greybox previs'),
    row('performance',7,'performance','rehearse blocking eyelines dialogue timing and prop interaction','run a performance pass',{failureModes:['collision','eyeline drift']}),
    row('generation',8,'generation','render approved performance','generate final shots'),
    row('voice',9,'voice','bind canonical voices','render dialogue with voice identity'),
    row('edit',10,'edit','assemble editable cut','edit on a versioned timeline'),
    row('audio',11,'audio','finish sound without flattening editability','mix dialogue music foley and stems'),
    row('review',12,'review','select coherent takes','pick whichever looks best'),
    row('delivery',13,'delivery','deliver master plus editable project','export master stems project and provenance'),
    row('social',14,'social','derive campaign assets','cut platform derivatives from approved master'),
  ];
}

describe('DIRECTOR-REPLICATE.12 certification matrix',()=>{
  for(const profile of profiles){
    it(`${profile.id}: compiles study evidence into an improved rehearsal-aware editable production plan`,()=>{
      const intent=detectProcessReplicationIntent(
        `${profile.command} using https://example.com/reference and give me the editable project`,
      );
      expect(intent?.targetDurationSeconds).toBe(profile.duration);
      expect(intent?.targetKind).toBe(profile.targetKind);
      expect(intent?.improve).toBe(true);
      expect(intent?.editableDelivery).toBe(true);

      const reference=compileProcessRecipe({
        id:`recipe:${profile.id}:reference`,
        projectId:`project:${profile.id}`,
        objective:profile.command,
        sourceRefs:['https://example.com/reference'],
        targetDurationSeconds:profile.duration,
        observations:observations(profile.id),
      });
      const improvements=deriveDirectorNativeImprovements(reference);
      const improved=improveProcessRecipe(reference,improvements);
      const graph=compileRecipeToCreativeStageGraph(improved);
      const stages=graph.list();

      expect(improved.targetDurationSeconds).toBe(profile.duration);
      expect(improved.improvementReceipts.length).toBeGreaterThanOrEqual(3);
      expect(stages.map(stage=>stage.kind)).toContain('rehearsal');
      expect(stages.findIndex(stage=>stage.kind==='previs')).toBeLessThan(stages.findIndex(stage=>stage.kind==='rehearsal'));
      expect(stages.findIndex(stage=>stage.kind==='rehearsal')).toBeLessThan(stages.findIndex(stage=>stage.kind==='generation'));
      expect(stages.findIndex(stage=>stage.kind==='generation')).toBeLessThan(stages.findIndex(stage=>stage.kind==='edit'));
      expect(stages.at(-1)?.kind).toBe('final');

      const generation=stages.find(stage=>stage.kind==='generation');
      const rehearsal=stages.find(stage=>stage.kind==='rehearsal');
      const previs=stages.find(stage=>stage.kind==='previs');
      expect(generation&&rehearsal&&previs).toBeTruthy();
      const rerun=graph.planRerun(generation!.id,{
        stageId:generation!.id,
        reason:'localized coherence failure',
        at:'2026-09-27T00:00:00Z',
      });
      expect(rerun.stageIds).toContain(generation!.id);
      expect(rerun.stageIds).not.toContain(rehearsal!.id);
      expect(rerun.stageIds).not.toContain(previs!.id);

      const rehearsalPlan:RehearsalPlan={
        id:`rehearsal:${profile.id}`,
        projectId:`project:${profile.id}`,
        sceneId:'scene:1',
        mode:'blocking',
        characterIds:['mike','jane'],
        cues:[
          {id:'cue:1',characterId:'mike',beatRef:'beat:1',action:'cross to table',startSeconds:0,endSeconds:2},
          {id:'cue:2',characterId:'jane',beatRef:'beat:2',lineRef:'line:2',startSeconds:2,endSeconds:4},
        ],
        referenceAssetIds:['character:mike','character:jane','table:1'],
        wardrobePlanRefs:['wardrobe:mike','wardrobe:jane'],
        cameraPlanRefs:['camera:scene:1'],
        maxTakes:3,
        escalationOrder:['blocking','performance','interaction','camera','full-dress'],
        evidenceIds:['story:scene:1'],
        authority:'DIRECTOR_REHEARSAL_PLAN',
      };
      const first=evaluateRehearsalTake(rehearsalPlan,{
        takeNumber:1,
        mode:'blocking',
        observations:[{
          id:'obs:collision',planId:rehearsalPlan.id,takeNumber:1,characterId:'mike',cueId:'cue:1',
          issue:'collision',severity:'fix',message:'Move Mike half a step camera-left before the cross.',score:.62,evidenceIds:['preview:1'],
        }],
      });
      expect(first.disposition).toBe('retry');
      expect(first.notes).toHaveLength(1);
      expect(evaluateRehearsalTake(rehearsalPlan,{takeNumber:2,mode:'blocking',observations:[]}).disposition).toBe('approve');
      const approvedTake:RehearsalTake={
        id:'take:approved',planId:rehearsalPlan.id,takeNumber:2,mode:'blocking',
        observations:[],directorNotes:[],status:'approved',evidenceIds:['preview:2'],
      };
      expect(rehearsalGraduationReceipt(rehearsalPlan,approvedTake)[0]).toContain('director-rehearsal:');

      const project:DirectorProductionProject={
        id:`project:${profile.id}`,
        ownerUserId:'00000000-0000-0000-0000-000000000001',
        version:1,
        title:profile.id,
        processRecipeId:improved.id,
        storyBibleId:'story:1',
        castBibleId:'cast:1',
        voiceBibleId:'voice:1',
        audioBibleId:'audio:1',
        productionAssetRefs:['character:mike','wardrobe:mike','table:1'],
        wardrobePlanRefs:['wardrobe:mike'],
        adapterRefs:['adapter:mike'],
        performanceMasterRefs:['performance:scene:1'],
        rehearsalPlanRefs:[rehearsalPlan.id],
        rehearsalApprovedTakeRefs:[approvedTake.id],
        creativeDirectiveRefs:['directive:editable'],
        timelineVersionId:'timeline:v1',
        finalMasterAssetId:'master:v1',
        status:'final',
        evidenceIds:['certification:'+profile.id],
        createdAt:'2026-09-27T00:00:00Z',
        updatedAt:'2026-09-27T00:00:00Z',
        authority:'DIRECTOR_PRODUCTION_PROJECT',
      };
      expect(validateDirectorProductionProject(project)).toEqual([]);
      expect(validateDirectorProductionProject({...project,timelineVersionId:undefined})).toContain('DIRECTOR_PROJECT_FINAL_TIMELINE_REQUIRED');
    });
  }
});
