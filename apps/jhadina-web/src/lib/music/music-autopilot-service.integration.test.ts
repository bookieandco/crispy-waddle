import {describe,expect,it,vi} from 'vitest';
import {defaultMusicAutopilotCharter} from '@jhadina/growth-core';
import {runMusicAutopilot,type MusicAutopilotDependencies} from './music-autopilot-service';

/** Runs the real orchestrator with hermetic ports: no Supabase, social account,
 * Director provider, money movement or external publish is invoked. */
function harness(enabled:boolean){
  const release=vi.fn().mockResolvedValue(null);
  const submitDirector=vi.fn();
  const requestSocial=vi.fn();
  const plan=vi.fn(async ({plan}: {plan:{actionKey:string;kind:string;stage:string}})=>({
    id:'action',actionKey:plan.actionKey,kind:plan.kind,stage:plan.stage,
    status:'planned',sideEffectState:'NONE',attempt:0,outputRefs:[],evidenceRefs:[],inputRefs:[],
  }));
  const charter={...defaultMusicAutopilotCharter(),enabled};
  const project={
    project:{id:'music-project'},songs:[],experiments:[],observations:[],cityDemand:[],
    rights:[],learning:[],outliers:[],mode:'SEARCH',rankedSongs:[],venues:[],
    creativePortfolio:{briefs:[{
      id:'brief:1',songId:'song:1',family:'story',sectionId:'section:1',
      hook:'A real moment',capturePlan:'Create a private demo',environment:'studio',
      evidenceRefs:['original:1'],authority:'CREATIVE_BRIEF_ONLY',
    }]},fanAudience:undefined,
  };
  const emptyTable={select:()=>emptyTable,eq:()=>emptyTable,order:()=>emptyTable,
    limit:()=>emptyTable,maybeSingle:async()=>({data:null,error:null}),
    count:0,error:null};
  const actionsTable={select:()=>actionsTable,eq:()=>actionsTable,count:0,error:null};
  const client={from:(table:string)=>table==='jhadina_music_autopilot_actions'?actionsTable:emptyTable};
  const deps={
    client,
    autopilotRepository:{
      getCharter:vi.fn().mockResolvedValue(charter),
      beginRun:vi.fn().mockResolvedValue({id:'run1'}),
      claimRun:vi.fn().mockResolvedValue({id:'run1'}),
      releaseRun:release,appendStageReceipt:vi.fn().mockResolvedValue(null),
      upsertPlannedAction:plan,getAction:vi.fn().mockResolvedValue(null),
      transitionAction:vi.fn(async ({actionKey,status}:{actionKey:string;status:string})=>({
        actionKey,status,outputRefs:[],sideEffectState:'NONE',attempt:0,
      })),
    },
    musicRepository:{},perceptionBindings:{listEnabled:vi.fn().mockResolvedValue([])},
    lineageRepository:{},socialRepository:{listAccounts:vi.fn().mockResolvedValue([])},
    runTick:vi.fn().mockResolvedValue({admittedLearningKeys:[],externalActionsStarted:false}),
    loadProjection:vi.fn().mockResolvedValue(project),
    reconcileDirector:vi.fn().mockResolvedValue({}),
    restorationHealth:vi.fn().mockResolvedValue({status:'not_ready',productionReady:false}),
    submitDirector,requestSocial,now:()=>new Date('2026-10-14T00:00:00.000Z'),
    schedulerMode:true,
  } as unknown as MusicAutopilotDependencies;
  return {deps,release,submitDirector,requestSocial};
}

describe('MUSIC-JUGGERNAUT-HARDEN.01 real orchestration safety',()=>{
  it('halts immediately for disabled owner charter',async()=>{
    const h=harness(false);
    const receipt=await runMusicAutopilot({userId:'owner',runKey:'disabled'},h.deps);
    expect(receipt.charterEnabled).toBe(false);
    expect(receipt.blockers).toContain('MUSIC_AUTOPILOT_DISABLED');
    expect(h.release).toHaveBeenCalledWith(expect.objectContaining({status:'blocked'}));
    expect(h.submitDirector).not.toHaveBeenCalled();
    expect(h.requestSocial).not.toHaveBeenCalled();
  });
  it('does not fabricate a platform-attributed experiment or report a complete run',async()=>{
    const h=harness(true);
    const receipt=await runMusicAutopilot({userId:'owner',runKey:'unattributed'},h.deps);
    expect(receipt.blockers).toContain('MUSIC_AUTOPILOT_ATTRIBUTABLE_ACCOUNT_REQUIRED');
    expect(receipt.stages.find((s)=>s.stage==='MUSIC-AUTO.2')?.status).toBe('waiting');
    expect(receipt.stages.find((s)=>s.stage==='MUSIC-AUTO.3')?.status).toBe('waiting');
    expect(h.release).toHaveBeenCalledWith(expect.objectContaining({status:'blocked'}));
    expect(h.submitDirector).not.toHaveBeenCalled();
    expect(h.requestSocial).not.toHaveBeenCalled();
    expect(receipt.externalActionsStarted).toBe(false);
  });
});
