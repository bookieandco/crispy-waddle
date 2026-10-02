import type {SupabaseClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import type {MusicCreativeBrief,MusicAutopilotStage} from '@jhadina/growth-core';
import {
  buildMusicAutopilotActionPlan,
  certifyMusicAutopilotSource,
  recoveryPlanForMusicAutopilotFailure,
} from '@jhadina/growth-core';
import {createServiceRoleClient} from '@/lib/supabase/service-role';
import {createMusicJuggernautRepository,type MusicJuggernautRepository} from './music-juggernaut-repository';
import {runMusicJuggernautTick} from './music-juggernaut-tick';
import {loadMusicJuggernautProjection} from './music-juggernaut-service';
import {perceiveSongSectionsIntoJuggernaut} from './music-section-perception-bridge';
import {
  createMusicAutopilotRepository,
  type MusicAutopilotActionRecord,
  type MusicAutopilotRepository,
} from './music-autopilot-repository';
import {
  createMusicPerceptionBindingRepository,
  type MusicPerceptionBindingRepository,
} from './music-perception-binding-repository';
import {
  createMusicSocialLineageRepository,
  type MusicSocialLineageRepository,
} from './music-social-lineage-repository';
import {createAndSubmitAskVideoJob,getAskVideoJobForUser} from '../director-video-job-service';
import {reconcileDirectorVideoJobs} from '../director-video-job-reconciler';
import {createConfiguredWholeVideoProviders} from '../director-whole-video-providers';
import {requestSocialPublication} from '../social/governed-publication';
import {createSocialRepository,type SocialRepository} from '../social/repository';
import {getMusicRestorationRuntimeHealth} from './restoration-runtime-server';
import {prepareMusicPaidCampaignProposal,type MusicPaidProposalInput,type MusicPaidProposalResult} from './music-paid-proposal-bridge';

type Row=Record<string,unknown>;
type Projection=NonNullable<Awaited<ReturnType<typeof loadMusicJuggernautProjection>>>;

export interface MusicAutopilotRunInput{
  userId:string;
  artistKey?:string;
  artistName?:string;
  runKey?:string;
  workerId?:string;
  paidProposal?:MusicPaidProposalInput;
}

export interface MusicAutopilotStageReceipt{
  stage:MusicAutopilotStage;
  status:'complete'|'blocked'|'waiting'|'skipped'|'failed';
  details:Readonly<Record<string,unknown>>;
}

export interface MusicAutopilotRunReceipt{
  runId:string;
  runKey:string;
  projectId:string;
  mode:'SEARCH'|'ATTACK';
  charterEnabled:boolean;
  stages:readonly MusicAutopilotStageReceipt[];
  externalActionsStarted:boolean;
  approvalRequired:boolean;
  blockers:readonly string[];
  sourceCertification:ReturnType<typeof certifyMusicAutopilotSource>;
}

export interface MusicAutopilotDependencies{
  autopilotRepository?:MusicAutopilotRepository;
  musicRepository?:MusicJuggernautRepository;
  perceptionBindings?:MusicPerceptionBindingRepository;
  lineageRepository?:MusicSocialLineageRepository;
  socialRepository?:SocialRepository;
  runTick?:typeof runMusicJuggernautTick;
  loadProjection?:typeof loadMusicJuggernautProjection;
  submitDirector?:typeof createAndSubmitAskVideoJob;
  getDirectorJob?:typeof getAskVideoJobForUser;
  reconcileDirector?:typeof reconcileDirectorVideoJobs;
  requestSocial?:typeof requestSocialPublication;
  restorationHealth?:typeof getMusicRestorationRuntimeHealth;
  preparePaid?:typeof prepareMusicPaidCampaignProposal;
  client?:SupabaseClient;
  schedulerMode?:boolean;
  now?:()=>Date;
}

export async function runMusicAutopilot(
  input:MusicAutopilotRunInput,
  overrides:MusicAutopilotDependencies={},
):Promise<MusicAutopilotRunReceipt>{
  const artistKey=input.artistKey?.trim()||'atwood-bookie';
  const artistName=input.artistName?.trim()||'Atwood Bookie';
  const now=overrides.now??(()=>new Date());
  const workerId=input.workerId?.trim()||'music-autopilot:'+randomUUID();
  const client=overrides.client??createServiceRoleClient();
  if(!client)throw new Error('MUSIC_AUTOPILOT_SERVICE_ROLE_NOT_CONFIGURED');
  const music=overrides.musicRepository??createMusicJuggernautRepository();
  const auto=overrides.autopilotRepository??createMusicAutopilotRepository(client);
  const bindingRepo=overrides.perceptionBindings??createMusicPerceptionBindingRepository(client);
  const lineageRepo=overrides.lineageRepository??createMusicSocialLineageRepository(client);
  const social=overrides.socialRepository??createSocialRepository();
  const runTick=overrides.runTick??runMusicJuggernautTick;
  const loadProjection=overrides.loadProjection??loadMusicJuggernautProjection;
  const submitDirector=overrides.submitDirector??createAndSubmitAskVideoJob;
  const getDirectorJob=overrides.getDirectorJob??getAskVideoJobForUser;
  const reconcileDirector=overrides.reconcileDirector??reconcileDirectorVideoJobs;
  const requestSocial=overrides.requestSocial??requestSocialPublication;
  const restorationHealth=overrides.restorationHealth??getMusicRestorationRuntimeHealth;
  const preparePaid=overrides.preparePaid??prepareMusicPaidCampaignProposal;
  const stages:MusicAutopilotStageReceipt[]=[];
  const blockers:string[]=[];
  let externalActionsStarted=false;
  let approvalRequired=false;

  const tick=await runTick({userId:input.userId,artistKey,artistName},{repository:music,socialRepository:social,lineageRepository:lineageRepo,client});
  let projection=await loadProjection({userId:input.userId,artistKey,artistName,initialize:true,repository:music,client});
  if(!projection)throw new Error('MUSIC_AUTOPILOT_PROJECT_UNAVAILABLE');
  const projectId=String(projection.project.id);
  const charter=await auto.getCharter(input.userId,projectId);
  const runKey=input.runKey?.trim()||defaultRunKey(projectId,now());
  const run=await auto.beginRun({userId:input.userId,projectId,runKey,mode:projection.mode});
  const claimed=await auto.claimRun({runId:run.id,userId:input.userId,workerId,leaseSeconds:180});
  if(!claimed)throw new Error('MUSIC_AUTOPILOT_RUN_LEASE_UNAVAILABLE');

  const record=async(stage:MusicAutopilotStage,status:MusicAutopilotStageReceipt['status'],details:Record<string,unknown>)=>{
    const receipt:MusicAutopilotStageReceipt=Object.freeze({stage,status,details:Object.freeze({...details})});
    stages.push(receipt);
    await auto.appendStageReceipt({runId:run.id,userId:input.userId,workerId,stage,receipt:{status,...details}});
  };

  try{
    if(!charter.enabled){
      blockers.push('MUSIC_AUTOPILOT_DISABLED');
      await record('MUSIC-AUTO.4','blocked',{reason:'Owner autopilot charter is disabled. Internal Music planning remains available.'});
      await auto.releaseRun({runId:run.id,userId:input.userId,workerId,status:'blocked',currentStage:'MUSIC-AUTO.4',lastError:'MUSIC_AUTOPILOT_DISABLED'});
      return Object.freeze({
        runId:run.id,runKey,projectId,mode:projection.mode,charterEnabled:false,
        stages:Object.freeze(stages),externalActionsStarted:false,approvalRequired:false,
        blockers:Object.freeze(blockers),sourceCertification:certifyMusicAutopilotSource(),
      });
    }

    // MUSIC-AUTO.1 — Live Music Perception.
    let runtimeHealth:Awaited<ReturnType<typeof getMusicRestorationRuntimeHealth>>|undefined;
    let runtimeHealthError:string|undefined;
    try{
      runtimeHealth=await restorationHealth();
    }catch(error){
      runtimeHealthError=errorMessage(error);
    }
    const ready=runtimeHealth?.status==='ready'&&runtimeHealth.productionReady===true;
    const bindings=await bindingRepo.listEnabled(input.userId,projectId);
    if(bindings.length===0)blockers.push('MUSIC_AUTOPILOT_PERCEPTION_BINDING_REQUIRED');
    let perceptionSynced=0,perceptionWaiting=0;
    if(ready){
      for(const binding of bindings){
        const song=projection.songs.find((row)=>String(row.id)===binding.songId);
        if(!song)continue;
        const already=Array.isArray(song.sections)&&song.sections.some((raw)=>{
          if(!raw||typeof raw!=='object')return false;
          return String((raw as Row).sourceArtifactId??(raw as Row).source_artifact_id??'')===binding.artifactId;
        });
        if(already)continue;
        const plan=buildMusicAutopilotActionPlan({
          projectId,stage:'MUSIC-AUTO.1',kind:'PERCEIVE_SECTION',
          lineageKey:binding.songId+':'+binding.artifactId,charter,
          reason:'Bound restoration artifact is eligible for measured structural perception.',
          evidenceRefs:['restoration-artifact:'+binding.artifactId],
        });
        const existing=await auto.upsertPlannedAction({runId:run.id,userId:input.userId,projectId,plan});
        if(existing.status==='completed')continue;
        try{
          await auto.transitionAction({userId:input.userId,projectId,actionKey:plan.actionKey,status:'running',incrementAttempt:true});
          const receipt=await perceiveSongSectionsIntoJuggernaut({
            client,userId:input.userId,artistKey,songId:binding.songId,caseId:binding.caseId,
            artifactId:binding.artifactId,minimumConfidence:binding.minimumConfidence,
          },{repository:music});
          await bindingRepo.markSynced({userId:input.userId,projectId,songId:binding.songId,runtimeReceiptId:receipt.runtimeReceiptId});
          await auto.transitionAction({
            userId:input.userId,projectId,actionKey:plan.actionKey,status:'completed',
            outputRefs:['perception-receipt:'+receipt.runtimeReceiptId],sideEffectState:'NONE',
          });
          perceptionSynced+=1;
        }catch(error){
          const message=errorMessage(error);
          await auto.transitionAction({userId:input.userId,projectId,actionKey:plan.actionKey,status:'failed',lastError:message,sideEffectState:'NONE'});
          blockers.push(message);
        }
      }
    }else{
      perceptionWaiting=bindings.length;
      if(bindings.length)blockers.push('MUSIC_RESTORATION_RUNTIME_NOT_READY');
    }
    await record('MUSIC-AUTO.1',ready&&bindings.length>0?'complete':'waiting',{
      runtimeReady:ready,
      runtimeHealth:runtimeHealth??null,
      runtimeHealthError:runtimeHealthError??null,
      bindingCount:bindings.length,synced:perceptionSynced,waiting:perceptionWaiting,
    });

    projection=await loadRequiredProjection(loadProjection,{userId:input.userId,artistKey,artistName,repository:music,client});

    // Advance previously submitted Director jobs before deciding what can flow to Social.
    const directorReconciliation=await reconcileDirector(client,{limit:Math.max(5,charter.maxDirectorJobsPerRun*2),userId:input.userId});

    // MUSIC-AUTO.2 + .6/.7 — durable experiments -> Director jobs.
    const accounts=await social.listAccounts(input.userId);
    const allowedAccounts=accounts.filter((account)=>account.status==='connected'&&charter.allowedSocialAccountIds.includes(account.id));
    const defaultPlatform=allowedAccounts[0]?.platform??'cross-platform-staging';
    const briefs=projection.creativePortfolio?.briefs.slice(0,charter.maxDirectorJobsPerRun)??[];
    const experimentByBrief=new Map<string,Row>();
    let directorSubmitted=0,directorAwaitingApproval=0,directorBlocked=0;

    for(const brief of briefs){
      const experiment=await ensureBriefExperiment({music,projection,projectId,brief,platform:defaultPlatform});
      experimentByBrief.set(brief.id,experiment);
      const experimentKey=String(experiment.experiment_key);
      const experimentPlan=buildMusicAutopilotActionPlan({
        projectId,
        stage:projection.mode==='SEARCH'?'MUSIC-AUTO.6':'MUSIC-AUTO.7',
        kind:projection.mode==='SEARCH'?'SEARCH_EXPERIMENT':'ATTACK_VARIANT',
        lineageKey:experimentKey,
        charter,
        reason:projection.mode==='SEARCH'
          ?'Evidence-backed creative experiment is admitted to the SEARCH portfolio.'
          :'Validated ATTACK mode is varying the wrapper around the winning music signal.',
        evidenceRefs:brief.evidenceRefs,
      });
      const experimentAction=await auto.upsertPlannedAction({
        runId:run.id,userId:input.userId,projectId,plan:experimentPlan,
        inputRefs:['brief:'+brief.id,'song:'+brief.songId],
      });
      if(experimentAction.status!=='completed'){
        await auto.transitionAction({
          userId:input.userId,projectId,actionKey:experimentPlan.actionKey,status:'completed',
          sideEffectState:'NONE',outputRefs:['experiment:'+experimentKey],
        });
      }
      const plan=buildMusicAutopilotActionPlan({
        projectId,stage:'MUSIC-AUTO.2',kind:'DIRECTOR_PRODUCTION',
        lineageKey:experimentKey+':'+brief.id,charter,
        reason:'Music creative brief is ready for Director production.',
        evidenceRefs:brief.evidenceRefs,
      });
      let action=await auto.upsertPlannedAction({
        runId:run.id,userId:input.userId,projectId,plan,
        inputRefs:['experiment:'+experimentKey,'brief:'+brief.id,'song:'+brief.songId],
      });
      action=await reconcileDirectorAction({action,userId:input.userId,projectId,auto,getDirectorJob,client});
      if(action.status==='awaiting_approval'||action.status==='completed'){
        directorAwaitingApproval+=1;
        continue;
      }
      if(action.status==='running'){
        continue;
      }
      if(action.status==='ambiguous'){
        directorBlocked+=1;
        continue;
      }
      if(action.status==='blocked'||action.status==='failed'){
        const recovery=recoveryPlanForMusicAutopilotFailure({
          actionKey:action.actionKey,
          kind:'DIRECTOR_PRODUCTION',
          errorCode:action.lastError??action.status,
          sideEffectState:action.sideEffectState,
          attempt:action.attempt,
          providerReference:action.providerReference,
        },{maxAttempts:3,pauseOnAmbiguousExternalState:charter.pauseOnAmbiguousExternalState});
        if(recovery.disposition!=='RETRY'){
          directorBlocked+=1;
          continue;
        }
      }
      if(plan.authority!=='AUTONOMOUS_WITHIN_CHARTER'){
        await auto.transitionAction({userId:input.userId,projectId,actionKey:plan.actionKey,status:'awaiting_approval',lastError:'DIRECTOR_PREPARATION_NOT_IN_CHARTER'});
        approvalRequired=true;
        continue;
      }
      try{
        await auto.transitionAction({userId:input.userId,projectId,actionKey:plan.actionKey,status:'running',incrementAttempt:true});
        const submitted=await submitDirector({
          userId:input.userId,
          activeTask:directorPrompt(projection,brief,experimentKey),
          clientRequestId:plan.actionKey,
          productionQuality:true,
        },{client});
        const job=submitted.job;
        const refs=['director-job:'+job.id,'experiment:'+experimentKey,'brief:'+brief.id,'song:'+brief.songId];
        if(job.providerJobId)refs.push('director-provider-job:'+job.providerJobId);
        if(job.error==='DIRECTOR_VIDEO_SUBMISSION_UNCERTAIN'){
          await auto.transitionAction({
            userId:input.userId,projectId,actionKey:plan.actionKey,status:'ambiguous',
            sideEffectState:'AMBIGUOUS',outputRefs:refs,providerReference:job.providerJobId,lastError:job.error,
          });
          blockers.push(job.error);
        }else if(job.status==='blocked'||job.status==='failed'||job.status==='cancelled'){
          await auto.transitionAction({
            userId:input.userId,projectId,actionKey:plan.actionKey,status:'blocked',
            sideEffectState:job.providerJobId?'CONFIRMED':'NONE',outputRefs:refs,providerReference:job.providerJobId,lastError:job.error??job.status,
          });
          blockers.push(job.error??'DIRECTOR_VIDEO_BLOCKED');
          directorBlocked+=1;
        }else{
          await auto.transitionAction({
            userId:input.userId,projectId,actionKey:plan.actionKey,status:'running',
            sideEffectState:job.providerJobId?'CONFIRMED':'NONE',outputRefs:refs,providerReference:job.providerJobId,
          });
          directorSubmitted+=1;
          externalActionsStarted=externalActionsStarted||Boolean(job.providerJobId);
        }
      }catch(error){
        const message=errorMessage(error);
        const current=await auto.getAction(input.userId,projectId,plan.actionKey);
        const recovery=recoveryPlanForMusicAutopilotFailure({
          actionKey:plan.actionKey,kind:'DIRECTOR_PRODUCTION',errorCode:message,
          sideEffectState:current?.sideEffectState??'NONE',attempt:current?.attempt??1,
          providerReference:current?.providerReference,
        },{pauseOnAmbiguousExternalState:charter.pauseOnAmbiguousExternalState});
        await auto.transitionAction({
          userId:input.userId,projectId,actionKey:plan.actionKey,
          status:recovery.disposition==='RECONCILE'?'ambiguous':'failed',
          lastError:message,sideEffectState:current?.sideEffectState??'NONE',
        });
        blockers.push(message);
      }
    }

    await record('MUSIC-AUTO.2',directorBlocked?'waiting':'complete',{
      requestedBriefs:briefs.length,submitted:directorSubmitted,awaitingAssetApproval:directorAwaitingApproval,
      blocked:directorBlocked,reconciliation:directorReconciliation,
    });
    await record('MUSIC-AUTO.6',projection.mode==='SEARCH'?'complete':'skipped',{
      mode:projection.mode,plannedExperiments:projection.experiments.length,creativeBriefs:briefs.length,
      rule:'SEARCH stays low-spend and diversity-first until replicated quality evidence validates an outlier.',
    });
    await record('MUSIC-AUTO.7',projection.mode==='ATTACK'?'complete':'skipped',{
      mode:projection.mode,validatedOutliers:projection.outliers.filter((item)=>item.status==='validated').length,
      rule:'ATTACK concentrates on validated evidence while varying wrappers and preserving rights/budget gates.',
    });

    // MUSIC-AUTO.3 — approved Director asset -> governed Social proposal with explicit lineage.
    let socialPrepared=0,socialWaiting=0,socialBlocked=0;
    for(const brief of briefs.slice(0,charter.maxSocialProposalsPerRun)){
      const experiment=experimentByBrief.get(brief.id);
      if(!experiment)continue;
      const experimentKey=String(experiment.experiment_key);
      const directorKey=buildMusicAutopilotActionPlan({
        projectId,stage:'MUSIC-AUTO.2',kind:'DIRECTOR_PRODUCTION',
        lineageKey:experimentKey+':'+brief.id,charter,reason:'lookup',evidenceRefs:brief.evidenceRefs,
      }).actionKey;
      const directorAction=await auto.getAction(input.userId,projectId,directorKey);
      const jobId=refValue(directorAction?.outputRefs??[],'director-job:');
      if(!jobId){socialWaiting+=1;continue;}
      const approved=await approvedDirectorMedia(client,input.userId,jobId);
      if(!approved){socialWaiting+=1;approvalRequired=true;continue;}
      if(!allowedAccounts.length){
        socialBlocked+=1;blockers.push('MUSIC_AUTOPILOT_SOCIAL_ACCOUNT_SCOPE_EMPTY');continue;
      }
      const plan=buildMusicAutopilotActionPlan({
        projectId,stage:'MUSIC-AUTO.3',kind:'SOCIAL_PROPOSAL',
        lineageKey:experimentKey+':'+approved.assetId,charter,
        reason:'Approved Director asset is ready for an immutable Social publication proposal.',
        evidenceRefs:[...brief.evidenceRefs,'director-asset:'+approved.assetId,'director-approval:'+approved.approvalId],
      });
      let action=await auto.upsertPlannedAction({
        runId:run.id,userId:input.userId,projectId,plan,
        inputRefs:['experiment:'+experimentKey,'brief:'+brief.id,'director-asset:'+approved.assetId],
      });
      if(action.status==='completed'||action.status==='awaiting_approval')continue;
      if(overrides.schedulerMode){
        socialWaiting+=1;
        approvalRequired=true;
        continue;
      }
      try{
        await auto.transitionAction({userId:input.userId,projectId,actionKey:plan.actionKey,status:'running',incrementAttempt:true});
        const proposal=await requestSocial({
          brand:'atwood-bookie',
          text:socialCaption(projection,brief),
          mediaUrls:[approved.signedUrl],
          targetAccountIds:allowedAccounts.map((account)=>account.id),
          idempotencyKey:plan.actionKey,
        });
        await lineageRepo.bind({
          userId:input.userId,projectId,proposalId:proposal.proposal.id,experimentKey,
          songId:brief.songId,briefId:brief.id,actionKey:plan.actionKey,
          evidenceRefs:plan.evidenceRefs,
        });
        const finalStatus=proposal.proposal.status==='delivered'||proposal.proposal.status==='queued'?'completed':'awaiting_approval';
        await auto.transitionAction({
          userId:input.userId,projectId,actionKey:plan.actionKey,status:finalStatus,
          outputRefs:['social-proposal:'+proposal.proposal.id,'social-approval:'+proposal.approvalReceiptId],
          sideEffectState:'NONE',
        });
        socialPrepared+=1;
        if(finalStatus==='awaiting_approval')approvalRequired=true;
      }catch(error){
        const message=errorMessage(error);
        await auto.transitionAction({userId:input.userId,projectId,actionKey:plan.actionKey,status:'failed',lastError:message,sideEffectState:'NONE'});
        blockers.push(message);socialBlocked+=1;
      }
    }
    await record('MUSIC-AUTO.3',(socialBlocked||socialWaiting)?'waiting':'complete',{
      prepared:socialPrepared,waitingForApprovedDirectorAsset:socialWaiting,blocked:socialBlocked,
      accountScope:allowedAccounts.map((account)=>account.id),
      lineage:'proposal -> musicExperimentKey is persisted in jhadina_music_social_lineage',
      schedulerMode:Boolean(overrides.schedulerMode),
      schedulerBoundary:overrides.schedulerMode?'Prepared assets stop before user-session-bound Social approval materialization.':null,
    });

    // MUSIC-AUTO.4 — durable runner evidence.
    await record('MUSIC-AUTO.4','complete',{
      runId:run.id,runKey,workerId,leaseSeconds:180,idempotentActionLedger:true,
      ambiguousExternalStatePolicy:charter.pauseOnAmbiguousExternalState?'reconcile-before-retry':'stop',
    });

    // MUSIC-AUTO.5 — provider readiness.
    const configuredDirectorProviders=createConfiguredWholeVideoProviders({includeCertification:false}).map((provider)=>provider.descriptor.id);
    await record('MUSIC-AUTO.5',allowedAccounts.length&&configuredDirectorProviders.length&&ready?'complete':'waiting',{
      restorationReady:ready,
      restorationHealth:runtimeHealth??null,
      connectedScopedSocialAccounts:allowedAccounts.length,
      configuredDirectorProviders,
      liveProviderDataReady:Boolean(allowedAccounts.length&&configuredDirectorProviders.length&&ready),
    });

    // MUSIC-AUTO.8 — bounded paid Growth bridge only when canonical budget/campaign bindings are supplied.
    let paidResult:MusicPaidProposalResult|undefined;
    const paidCandidate=input.paidProposal?.outlier??projection.outliers.find((item)=>item.status==='validated');
    let paidAction:MusicAutopilotActionRecord|undefined;
    let paidPlanKey:string|undefined;
    if(projection.mode==='ATTACK'){
      const paidPlan=buildMusicAutopilotActionPlan({
        projectId,stage:'MUSIC-AUTO.8',kind:'PAID_PROPOSAL',
        lineageKey:paidCandidate?.experimentId??'paid-input-required',
        charter,
        reason:input.paidProposal
          ?'Canonical budget, rights, audience and creative bindings are present for bounded paid-growth evaluation.'
          :'Validated ATTACK evidence exists, but paid growth still requires canonical budget and campaign bindings.',
        evidenceRefs:paidCandidate?.evidenceRefs??[],
      });
      paidPlanKey=paidPlan.actionKey;
      paidAction=await auto.upsertPlannedAction({runId:run.id,userId:input.userId,projectId,plan:paidPlan});
    }
    if(input.paidProposal&&projection.mode==='ATTACK'){
      if(!charter.allowPreapprovedPaidTests){
        approvalRequired=true;
        blockers.push('MUSIC_AUTOPILOT_PAID_TESTS_NOT_IN_CHARTER');
      }else if(input.paidProposal.requestedMinor>charter.maxPreapprovedPaidMinorPerRun){
        blockers.push('MUSIC_AUTOPILOT_PAID_RUN_LIMIT_EXCEEDED');
      }else{
        paidResult=await preparePaid({
          ...input.paidProposal,
          preAuthorizedLimitMinor:Math.min(input.paidProposal.preAuthorizedLimitMinor,charter.maxPreapprovedPaidMinorPerRun),
        });
        approvalRequired=approvalRequired||paidResult.approvalRequired;
        if(paidPlanKey&&paidAction&&paidAction.status!=='completed'&&paidAction.status!=='awaiting_approval'){
          const campaignRefs=paidResult.campaign
            ?['growth-paid-campaign:'+paidResult.campaign.campaign.id,'growth-paid-approval:'+paidResult.campaign.approvalReceiptId]
            :['spend-decision:'+paidResult.decision.action];
          await auto.transitionAction({
            userId:input.userId,projectId,actionKey:paidPlanKey,
            status:paidResult.approvalRequired?'awaiting_approval':'completed',
            sideEffectState:'NONE',outputRefs:campaignRefs,
          });
        }
      }
    }
    await record('MUSIC-AUTO.8',paidResult?'complete':projection.mode==='ATTACK'?'waiting':'skipped',{
      mode:projection.mode,
      paidInputPresent:Boolean(input.paidProposal),
      charterAllowsPreapprovedTests:charter.allowPreapprovedPaidTests,
      maxPerRunMinor:charter.maxPreapprovedPaidMinorPerRun,
      decision:paidResult?.decision.action??null,
      authorizedMinor:paidResult?.decision.authorizedMinor??0,
      approvalRequired:paidResult?.approvalRequired??false,
      missingBindings:projection.mode==='ATTACK'&&!input.paidProposal
        ?['canonical-budget','rights-record','provider-account','audience','creative']
        :[],
    });

    // MUSIC-AUTO.9 — fan / CRM flywheel projection.
    const fanPlan=buildMusicAutopilotActionPlan({
      projectId,stage:'MUSIC-AUTO.9',kind:'FAN_PROJECTION',
      lineageKey:'fan-projection:'+String(projection.fanAudience?.total??0)+':'+String(projection.fanAudience?.directlyReachable??0),
      charter,
      reason:projection.fanAudience?'Canonical Growth customer state was projected into the Music fan flywheel.':'No canonical fan/customer projection is available yet.',
      evidenceRefs:projection.fanAudience?.evidenceRefs??[],
    });
    const fanAction=await auto.upsertPlannedAction({runId:run.id,userId:input.userId,projectId,plan:fanPlan});
    if(projection.fanAudience&&fanAction.status!=='completed'){
      await auto.transitionAction({
        userId:input.userId,projectId,actionKey:fanPlan.actionKey,status:'completed',sideEffectState:'NONE',
        outputRefs:['fan-total:'+projection.fanAudience.total,'fan-direct:'+projection.fanAudience.directlyReachable],
      });
    }
    await record('MUSIC-AUTO.9',projection.fanAudience?'complete':'waiting',{
      totalKnownFans:projection.fanAudience?.total??0,
      directlyReachable:projection.fanAudience?.directlyReachable??0,
      ownedShare:projection.fanAudience?.ownedShare??0,
      evidenceRefs:projection.fanAudience?.evidenceRefs??[],
    });

    // MUSIC-AUTO.10 — rights + revenue gate.
    const rightsBlocked=projection.rights.filter((row)=>
      row.master_ownership_known!==true||row.publishing_known!==true||
      row.sample_status==='blocked'||row.sample_status==='review_required'||
      row.third_party_usage_status==='blocked'||row.third_party_usage_status==='review_required'
    );
    if(rightsBlocked.length)blockers.push('MUSIC_AUTOPILOT_RIGHTS_REVIEW_REQUIRED');

    const royalty=await latestRoyaltyEvidence(client,input.userId,projectId);
    const royaltyPlan=buildMusicAutopilotActionPlan({
      projectId,stage:'MUSIC-AUTO.10',kind:'ROYALTY_SYNC',
      lineageKey:royalty?.snapshotId??'royalty-evidence-required',charter,
      reason:royalty
        ?'Latest durable royalty statement is available as revenue evidence.'
        :'No durable royalty statement is available; revenue-aware scaling must wait.',
      evidenceRefs:royalty?['royalty-snapshot:'+royalty.snapshotId]:[],
    });
    const royaltyAction=await auto.upsertPlannedAction({
      runId:run.id,userId:input.userId,projectId,plan:royaltyPlan,
    });
    if(royalty&&royaltyAction.status!=='completed'){
      await auto.transitionAction({
        userId:input.userId,projectId,actionKey:royaltyPlan.actionKey,status:'completed',
        sideEffectState:'NONE',outputRefs:['royalty-snapshot:'+royalty.snapshotId],
      });
    }
    if(!royalty)blockers.push('MUSIC_AUTOPILOT_ROYALTY_EVIDENCE_REQUIRED');

    await record('MUSIC-AUTO.10',(rightsBlocked.length||!royalty)?'waiting':'complete',{
      rightsRecords:projection.rights.length,
      blockingOrUnknown:rightsBlocked.length,
      royaltyEvidencePresent:Boolean(royalty),
      latestRoyalty:royalty??null,
      rule:'Unknown/blocked rights or missing revenue evidence authorize zero aggressive commercial scaling.',
    });

    // MUSIC-AUTO.11 — evidence-backed live market loop.
    const topMarket=[...projection.venues].sort((a,b)=>b.confidence-a.confidence)[0];
    const livePlan=buildMusicAutopilotActionPlan({
      projectId,stage:'MUSIC-AUTO.11',kind:'LIVE_MARKET_RESEARCH',
      lineageKey:topMarket?('market:'+topMarket.city+':'+topMarket.recommendedCapacity):'market-data-required',
      charter,
      reason:topMarket?'Geographic demand produced an evidence-backed live-market candidate.':'No geographic demand is strong enough for a live-market candidate yet.',
      evidenceRefs:topMarket
        ?projection.cityDemand.filter((row)=>String(row.city_name)===topMarket.city).flatMap(rowEvidence)
        :[],
    });
    const liveAction=await auto.upsertPlannedAction({runId:run.id,userId:input.userId,projectId,plan:livePlan});
    if(topMarket&&liveAction.status!=='completed'){
      await auto.transitionAction({
        userId:input.userId,projectId,actionKey:livePlan.actionKey,status:'completed',sideEffectState:'NONE',
        outputRefs:['live-market:'+topMarket.city,'recommended-capacity:'+topMarket.recommendedCapacity],
      });
    }
    await record('MUSIC-AUTO.11',projection.venues.length?'complete':'waiting',{
      candidateMarkets:projection.venues.slice(0,8).map((venue)=>({
        city:venue.city,recommendedCapacity:venue.recommendedCapacity,confidence:venue.confidence,
      })),
      venueCommitmentAuthority:'APPROVAL_REQUIRED',
    });

    // MUSIC-AUTO.12 — recursive creative memory.
    for(const learningKey of tick.admittedLearningKeys){
      const learningRow=projection.learning.find((row)=>String(row.learning_key)===learningKey);
      const learningPlan=buildMusicAutopilotActionPlan({
        projectId,stage:'MUSIC-AUTO.12',kind:'LEARNING_ADMISSION',
        lineageKey:learningKey,charter,
        reason:'Replicated creative evidence was admitted as reusable Music learning.',
        evidenceRefs:learningRow?rowEvidence(learningRow):[],
      });
      const learningAction=await auto.upsertPlannedAction({
        runId:run.id,userId:input.userId,projectId,plan:learningPlan,
      });
      if(learningAction.status!=='completed'){
        await auto.transitionAction({
          userId:input.userId,projectId,actionKey:learningPlan.actionKey,status:'completed',
          sideEffectState:'NONE',outputRefs:['music-learning:'+learningKey],
        });
      }
    }
    await record('MUSIC-AUTO.12',tick.admittedLearningKeys.length?'complete':'waiting',{
      admittedLearningKeys:[...tick.admittedLearningKeys],
      reusableMechanicsOnly:true,
      note:'Winning mechanics may seed adjacent experiments; they are not assumed to generalize to every song.',
    });

    // MUSIC-AUTO.13 — fail/recovery source certification plus live ambiguity count.
    const certification=certifyMusicAutopilotSource();
    const ambiguousCount=await countAmbiguousActions(client,input.userId,projectId);
    if(ambiguousCount)blockers.push('MUSIC_AUTOPILOT_AMBIGUOUS_EXTERNAL_STATE');
    const recoveryPlan=buildMusicAutopilotActionPlan({
      projectId,stage:'MUSIC-AUTO.13',kind:'RECOVERY_RECONCILIATION',
      lineageKey:'ambiguity:'+ambiguousCount,charter,
      reason:ambiguousCount
        ?'One or more external actions have ambiguous provider truth and require reconciliation before retry.'
        :'No ambiguous external side effect remains unresolved.',
      evidenceRefs:[],
    });
    const recoveryAction=await auto.upsertPlannedAction({runId:run.id,userId:input.userId,projectId,plan:recoveryPlan});
    if(ambiguousCount===0&&recoveryAction.status!=='completed'){
      await auto.transitionAction({
        userId:input.userId,projectId,actionKey:recoveryPlan.actionKey,status:'completed',sideEffectState:'NONE',
        outputRefs:['ambiguity-count:0'],
      });
    }else if(ambiguousCount>0&&recoveryAction.status!=='blocked'){
      await auto.transitionAction({
        userId:input.userId,projectId,actionKey:recoveryPlan.actionKey,status:'blocked',sideEffectState:'NONE',
        lastError:'MUSIC_AUTOPILOT_AMBIGUOUS_EXTERNAL_STATE',
      });
    }
    await record('MUSIC-AUTO.13',certification.passed&&ambiguousCount===0?'complete':'waiting',{
      certificationVersion:certification.version,
      sourcePassed:certification.passed,
      ambiguousActionCount:ambiguousCount,
      noBlindExternalRetry:true,
    });

    await auto.releaseRun({
      runId:run.id,userId:input.userId,workerId,
      status:ambiguousCount?'blocked':'completed',currentStage:'MUSIC-AUTO.13',
      lastError:ambiguousCount?'MUSIC_AUTOPILOT_AMBIGUOUS_EXTERNAL_STATE':undefined,
    });
    return Object.freeze({
      runId:run.id,runKey,projectId,mode:projection.mode,charterEnabled:true,
      stages:Object.freeze(stages),externalActionsStarted,approvalRequired,
      blockers:Object.freeze([...new Set(blockers)]),sourceCertification:certification,
    });
  }catch(error){
    const message=errorMessage(error);
    blockers.push(message);
    try{
      await auto.releaseRun({runId:run.id,userId:input.userId,workerId,status:'failed',lastError:message});
    }catch{}
    throw error;
  }
}

async function ensureBriefExperiment(input:{
  music:MusicJuggernautRepository;
  projection:Projection;
  projectId:string;
  brief:MusicCreativeBrief;
  platform:string;
}):Promise<Row>{
  const existing=input.projection.experiments.find((row)=>
    String(row.song_id)===input.brief.songId&&
    String(row.content_family)===input.brief.family&&
    String(row.section_key??'')===String(input.brief.sectionId??'')
  );
  if(existing)return existing;
  const experimentKey='music-auto:'+safe(input.brief.id);
  return input.music.upsertExperiment({
    projectId:input.projectId,
    songId:input.brief.songId,
    experimentKey,
    sectionKey:input.brief.sectionId,
    hypothesis:'The '+input.brief.family.replaceAll('_',' ')+' treatment will create qualified music behavior beyond the artist baseline.',
    contentFamily:input.brief.family,
    platform:input.platform,
    spendMinor:0,
    currency:'USD',
    sampleTarget:500,
    successSignal:'Replicated lift in qualified views plus song actions/direct-fan capture.',
    failureSignal:'No qualified lift, weak downstream music action, or low-quality/bot-heavy traffic.',
    status:'planned',
    evidenceRefs:[...input.brief.evidenceRefs],
  });
}

async function reconcileDirectorAction(input:{
  action:MusicAutopilotActionRecord;
  userId:string;
  projectId:string;
  auto:MusicAutopilotRepository;
  getDirectorJob:typeof getAskVideoJobForUser;
  client:SupabaseClient;
}):Promise<MusicAutopilotActionRecord>{
  if(!['running','awaiting_approval'].includes(input.action.status))return input.action;
  const jobId=refValue(input.action.outputRefs,'director-job:');
  if(!jobId)return input.action;
  const job=await input.getDirectorJob(input.userId,jobId,{client:input.client});
  if(!job)return input.action;
  if(job.error==='DIRECTOR_VIDEO_SUBMISSION_UNCERTAIN'){
    return input.auto.transitionAction({
      userId:input.userId,projectId:input.projectId,actionKey:input.action.actionKey,
      status:'ambiguous',sideEffectState:'AMBIGUOUS',lastError:job.error,
    });
  }
  if(job.status==='failed'||job.status==='cancelled'||job.status==='blocked'){
    return input.auto.transitionAction({
      userId:input.userId,projectId:input.projectId,actionKey:input.action.actionKey,
      status:'blocked',sideEffectState:job.providerJobId?'CONFIRMED':'NONE',
      lastError:job.error??job.status,providerReference:job.providerJobId,
    });
  }
  if(job.previewAssetId){
    const refs=[...input.action.outputRefs];
    if(!refs.includes('director-asset:'+job.previewAssetId))refs.push('director-asset:'+job.previewAssetId);
    return input.auto.transitionAction({
      userId:input.userId,projectId:input.projectId,actionKey:input.action.actionKey,
      status:'awaiting_approval',sideEffectState:'CONFIRMED',outputRefs:refs,providerReference:job.providerJobId,
    });
  }
  return input.action;
}

async function approvedDirectorMedia(
  client:SupabaseClient,
  userId:string,
  jobId:string,
):Promise<{assetId:string;approvalId:string;signedUrl:string}|null>{
  const {data:job,error:jobError}=await client.from('director_video_jobs')
    .select('id,user_id,project_id,preview_asset_id').eq('id',jobId).eq('user_id',userId).maybeSingle();
  if(jobError)throw new Error('MUSIC_AUTOPILOT_DIRECTOR_JOB_READ_FAILED:'+jobError.message);
  if(!job?.preview_asset_id)return null;
  const assetId=String(job.preview_asset_id);
  const {data:approval,error:approvalError}=await client.from('director_editing_asset_approvals')
    .select('approval_id,approved_by_user_id').eq('asset_id',assetId).eq('approved_by_user_id',userId).maybeSingle();
  if(approvalError)throw new Error('MUSIC_AUTOPILOT_DIRECTOR_APPROVAL_READ_FAILED:'+approvalError.message);
  if(!approval)return null;
  const {data:asset,error:assetError}=await client.from('director_generated_editing_assets')
    .select('id,project_id,uri').eq('id',assetId).eq('project_id',String(job.project_id)).maybeSingle();
  if(assetError)throw new Error('MUSIC_AUTOPILOT_DIRECTOR_ASSET_READ_FAILED:'+assetError.message);
  const uri=asset?.uri?String(asset.uri):'';
  const prefix='storage://director-media/';
  if(!uri.startsWith(prefix))throw new Error('MUSIC_AUTOPILOT_DIRECTOR_ASSET_URI_INVALID');
  const objectPath=uri.slice(prefix.length);
  const {data:signed,error:signedError}=await client.storage.from('director-media').createSignedUrl(objectPath,3600);
  if(signedError||!signed?.signedUrl)throw new Error('MUSIC_AUTOPILOT_DIRECTOR_ASSET_SIGN_FAILED:'+(signedError?.message??'missing'));
  return {assetId,approvalId:String(approval.approval_id),signedUrl:signed.signedUrl};
}

function directorPrompt(projection:Projection,brief:MusicCreativeBrief,experimentKey:string):string{
  const song=projection.rankedSongs.find((item)=>item.id===brief.songId);
  const title=song?.title??'the selected song';
  return [
    'Create a short vertical 9:16 music video for '+title+'.',
    'Experiment: '+experimentKey+'.',
    'Creative family: '+brief.family+'.',
    'Hook: '+brief.hook,
    'Capture plan: '+brief.capturePlan,
    'Environment: '+brief.environment+'.',
    brief.sectionId?'Use the experiment-selected song section '+brief.sectionId+'.':'Use the strongest evidence-backed song moment.',
    'Preserve the song and experiment lineage. Do not publish or spend; return a production-quality asset for review.',
  ].join(' ');
}

function socialCaption(projection:Projection,brief:MusicCreativeBrief):string{
  const song=projection.rankedSongs.find((item)=>item.id===brief.songId);
  return [brief.hook,song?.title?('— '+song.title):''].filter(Boolean).join(' ');
}

async function loadRequiredProjection(
  loader:typeof loadMusicJuggernautProjection,
  input:Parameters<typeof loadMusicJuggernautProjection>[0],
):Promise<Projection>{
  const projection=await loader(input);
  if(!projection)throw new Error('MUSIC_AUTOPILOT_PROJECT_UNAVAILABLE');
  return projection;
}


async function latestRoyaltyEvidence(
  client:SupabaseClient,
  userId:string,
  projectId:string,
):Promise<{snapshotId:string;statementRef:string;currency:string;reportedTotalMinor:number;observedAt:string}|null>{
  const {data,error}=await client.from('jhadina_music_royalty_snapshots')
    .select('id,statement_ref,currency,reported_total_minor,observed_at')
    .eq('user_id',userId).eq('project_id',projectId)
    .order('observed_at',{ascending:false}).limit(1).maybeSingle();
  if(error)throw new Error('MUSIC_AUTOPILOT_ROYALTY_READ_FAILED:'+error.message);
  if(!data)return null;
  return Object.freeze({
    snapshotId:String(data.id),
    statementRef:String(data.statement_ref),
    currency:String(data.currency),
    reportedTotalMinor:Number(data.reported_total_minor),
    observedAt:String(data.observed_at),
  });
}

async function countAmbiguousActions(
  client:SupabaseClient,
  userId:string,
  projectId:string,
):Promise<number>{
  const {count,error}=await client.from('jhadina_music_autopilot_actions').select('id',{count:'exact',head:true})
    .eq('user_id',userId).eq('project_id',projectId).eq('status','ambiguous');
  if(error)throw new Error('MUSIC_AUTOPILOT_AMBIGUOUS_COUNT_FAILED:'+error.message);
  return count??0;
}

function rowEvidence(row:Row):string[]{
  const refs=Array.isArray(row.evidence_refs)?row.evidence_refs.map(String).filter(Boolean):[];
  return refs.length?refs:['music-record:'+String(row.id??'unknown')];
}
function defaultRunKey(projectId:string,at:Date):string{
  const bucket=Math.floor(at.getTime()/(15*60*1000));
  return 'music-auto:'+safe(projectId)+':'+bucket;
}
function refValue(refs:readonly string[],prefix:string):string|undefined{
  const ref=refs.find((value)=>value.startsWith(prefix));
  return ref?.slice(prefix.length);
}
function safe(value:string):string{
  return value.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,180);
}
function errorMessage(error:unknown):string{
  return error instanceof Error?error.message:String(error);
}
