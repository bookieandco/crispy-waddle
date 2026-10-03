import type {SupabaseClient} from '@supabase/supabase-js'
import {
  allocatePurseCapital,
  buildPurseAutonomousTradeIntent,
  buildPurseDecisionSet,
  buildPurseRebalancePlan,
  buildSharkCofferRuntimeResearch,
  type SharkCofferRuntimePolicy,
  type SharkMoneyTransportEnvelope,
} from '@jhadina/money-core'
import {admitSharkResearchToAutomatedCoffer} from './shark-coffer-opportunity-repository'
import {
  appendAutonomousIntent,
  appendRuntimeRun,
  countStrategyCalibrationSamples,
  findPurseIntentForOpportunity,
  hasTerminalRuntimeRun,
  listSharkRuntimeIngress,
  loadActiveAutonomousMandate,
  loadActivePurseCharters,
  loadAdmittedPurseOpportunities,
  loadCofferTreasurySnapshot,
  loadExecutionPackage,
  loadLatestPursePortfolio,
  loadPurseCapitalEvidence,
  loadPurseDecisionStyle,
  loadPurseLearningProfiles,
  persistPurseCycle,
  persistSharkCofferRuntimeResearch,
  portfolioExposures,
  runtimeRunId,
  type SharkCofferRuntimeRunReceipt,
  type SharkRuntimeIngressRecord,
} from './shark-coffer-runtime-repository'

export type SharkCofferRuntimeCycleResult=Readonly<{
  scannedIngress:number
  evaluatedCharterPairs:number
  researchReady:number
  blocked:number
  purseRejected:number
  purseAdmitted:number
  allocated:number
  autonomousIntentReady:number
  deferred:number
  skippedTerminal:number
  failures:readonly Readonly<{envelopeId:string;charterId?:string;reason:string}>[]
  authority:'RUNTIME_ORCHESTRATION_ONLY'
  canExecute:false
}>

const validIso=(value:string)=>Boolean(value)&&!Number.isNaN(Date.parse(value))
const latest=(...values:string[])=>new Date(Math.max(...values.map(v=>Date.parse(v)))).toISOString()
const addSeconds=(value:string,seconds:number)=>new Date(Date.parse(value)+seconds*1000).toISOString()
const intEnv=(name:string,fallback:number,min:number,max:number)=>{
  const raw=process.env[name]?.trim()
  if(!raw)return fallback
  const n=Number(raw)
  return Number.isInteger(n)&&n>=min&&n<=max?n:fallback
}
const numEnv=(name:string,fallback:number,min:number,max:number)=>{
  const raw=process.env[name]?.trim()
  if(!raw)return fallback
  const n=Number(raw)
  return Number.isFinite(n)&&n>=min&&n<=max?n:fallback
}
const bigintEnv=(name:string,fallback:bigint,min:bigint,max:bigint)=>{
  const raw=process.env[name]?.trim()
  if(!raw)return fallback
  try{
    const n=BigInt(raw)
    return n>=min&&n<=max?n:fallback
  }catch{return fallback}
}

function strategyId(envelope:SharkMoneyTransportEnvelope):string{
  switch(envelope.assessment.tradeType){
    case 'new-pair-speculation': return 'SHARK_RUNTIME_NEW_PAIR'
    case 'narrative': return 'SHARK_RUNTIME_NARRATIVE'
    case 'swing-hold': return 'SHARK_RUNTIME_SWING'
    case 'high-conviction': return 'SHARK_RUNTIME_HIGH_CONVICTION'
    case 'information-edge': return 'SHARK_RUNTIME_INFORMATION_EDGE'
    default:return 'SHARK_RUNTIME_MEME'
  }
}

function policyFor(input:{record:SharkRuntimeIngressRecord;baseTime:string}):SharkCofferRuntimePolicy{
  const ttl=intEnv('MONEY_SHARK_OPPORTUNITY_TTL_SECONDS',900,60,3600)
  const strategy=strategyId(input.record.envelope)
  return Object.freeze({
    policyId:'shark-coffer-runtime-policy:v1:'+strategy,
    strategyId:strategy,
    modelId:'money-shark-coffer-runtime',
    modelVersion:'1',
    methodologyVersion:'SHARK-COFFER.RUNTIME-01',
    minLiquidityUsd:numEnv('MONEY_SHARK_MIN_LIQUIDITY_USD',25000,0,1000000000),
    minCalibrationSamples:intEnv('MONEY_SHARK_MIN_CALIBRATION_SAMPLES',20,1,100000),
    minEvidenceQualityBps:intEnv('MONEY_SHARK_MIN_EVIDENCE_QUALITY_BPS',4500,0,10000),
    maxLiquidityParticipationBps:intEnv('MONEY_SHARK_MAX_LIQUIDITY_PARTICIPATION_BPS',10,1,1000),
    minimumCapitalMinor:bigintEnv('MONEY_SHARK_MIN_CAPITAL_MINOR',1000n,1n,100000000000n),
    opportunityExpiresAt:addSeconds(input.baseTime,ttl),
    authority:'POLICY_ONLY',
    canExecute:false,
  })
}

function baseTimeFor(record:SharkRuntimeIngressRecord):string{
  const values=[
    record.createdAt,
    record.envelope.assessment.assessedAt,
    record.envelope.assessment.informationCutoff,
    record.market.availableAt,
  ]
  if(values.some(v=>!validIso(v)))throw new Error('SHARK_COFFER_RUNTIME_INGRESS_TIME_INVALID')
  return latest(...values)
}

function receipt(input:{
  record:SharkRuntimeIngressRecord
  charter:{charterId:string;userId:string;cofferId:string}
  disposition:SharkCofferRuntimeRunReceipt['disposition']
  opportunityId?:string
  purseBusEventId?:string
  allocationPlanId?:string
  decisionSetId?:string
  rebalancePlanId?:string
  autonomousIntentId?:string
  runJson:unknown
  informationCutoff:string
  completedAt:string
  evidenceIds:readonly string[]
}):SharkCofferRuntimeRunReceipt{
  return Object.freeze({
    runId:runtimeRunId(input.record.envelope.envelopeId,input.charter.charterId,input.disposition),
    envelopeId:input.record.envelope.envelopeId,
    charterId:input.charter.charterId,
    userId:input.charter.userId,
    cofferId:input.charter.cofferId,
    disposition:input.disposition,
    opportunityId:input.opportunityId,
    purseBusEventId:input.purseBusEventId,
    allocationPlanId:input.allocationPlanId,
    decisionSetId:input.decisionSetId,
    rebalancePlanId:input.rebalancePlanId,
    autonomousIntentId:input.autonomousIntentId,
    runJson:input.runJson,
    informationCutoff:input.informationCutoff,
    completedAt:input.completedAt,
    evidenceIds:Object.freeze([...new Set(input.evidenceIds)].sort()),
    authority:'RUNTIME_EVIDENCE_ONLY',
    canExecute:false,
  })
}

export async function runSharkCofferRuntimeCycle(input:Readonly<{
  client:SupabaseClient
  now?:string
  limit?:number
}>):Promise<SharkCofferRuntimeCycleResult>{
  const now=input.now??new Date().toISOString()
  if(!validIso(now))throw new Error('SHARK_COFFER_RUNTIME_NOW_INVALID')
  const records=await listSharkRuntimeIngress(input.client,input.limit??100)
  const charters=await loadActivePurseCharters(input.client,now)
  const failures:Array<{envelopeId:string;charterId?:string;reason:string}>=[]
  let evaluatedCharterPairs=0,researchReady=0,blocked=0,purseRejected=0,purseAdmitted=0,allocated=0,autonomousIntentReady=0,deferred=0,skippedTerminal=0

  for(const record of records){
    const baseTime=baseTimeFor(record)
    const policy=policyFor({record,baseTime})
    for(const charter of charters){
      if(!charter.lanePolicies.some(x=>x.lane==='MEME'&&x.enabled))continue
      evaluatedCharterPairs+=1
      try{
        const terminal=await hasTerminalRuntimeRun(input.client,record.envelope.envelopeId,charter.charterId,{
          includeAllocated:charter.autonomyMode!=='LIVE_GOVERNED_INTENTS',
        })
        if(terminal){skippedTerminal+=1;continue}

        if(now>=policy.opportunityExpiresAt){
          await appendRuntimeRun(input.client,receipt({
            record,charter,disposition:'BLOCKED',
            runJson:{reasonCodes:['RUNTIME_OPPORTUNITY_EXPIRED_BEFORE_COMPLETION'],policyId:policy.policyId},
            informationCutoff:baseTime,completedAt:now,evidenceIds:[record.market.evidenceId],
          }))
          blocked+=1
          continue
        }

        const calibrationSampleSize=await countStrategyCalibrationSamples(input.client,{
          strategyId:policy.strategyId,informationCutoff:baseTime,userId:charter.userId,
        })
        const runtime=buildSharkCofferRuntimeResearch({
          envelope:record.envelope,
          ingressContext:{
            accountId:charter.cofferId,
            requestedBy:'money-shark-coffer-runtime',
            receivedAt:baseTime,
            sourceNamespace:'shark',
            evidenceQuality:'SUPPORTED',
          },
          market:record.market,
          policy,
          calibrationSampleSize,
          createdAt:baseTime,
        })
        await persistSharkCofferRuntimeResearch(input.client,{runtime,createdAt:baseTime})
        if(runtime.disposition==='MONEY_OPPORTUNITY_READY')researchReady+=1

        if(runtime.disposition!=='MONEY_OPPORTUNITY_READY'||!runtime.opportunity||!runtime.tradeMims||!runtime.validation){
          const disposition=runtime.disposition==='BLOCKED'?'BLOCKED':'RESEARCH_ONLY'
          await appendRuntimeRun(input.client,receipt({
            record,charter,disposition,
            runJson:{runtimeDisposition:runtime.disposition,reasonCodes:runtime.reasonCodes,thesisId:runtime.thesis.thesisId,dialecticId:runtime.dialectic.assessmentId},
            informationCutoff:runtime.informationCutoff,completedAt:now,evidenceIds:runtime.evidenceIds,
          }))
          if(disposition==='BLOCKED')blocked+=1
          continue
        }

        const admitted=await admitSharkResearchToAutomatedCoffer(input.client,{
          charter,
          research:runtime.research,
          candidate:runtime.opportunity,
          tradeMims:runtime.tradeMims,
          validation:runtime.validation,
          ingestedAt:baseTime,
        })
        const purseOpportunityId=admitted.opportunityEnvelope.opportunity.opportunityId
        if(!admitted.opportunityEnvelope.admitted){
          await appendRuntimeRun(input.client,receipt({
            record,charter,disposition:'PURSE_REJECTED',
            opportunityId:purseOpportunityId,purseBusEventId:admitted.opportunityEnvelope.busEventId,
            runJson:{reasonCodes:admitted.opportunityEnvelope.reasonCodes,mimsStatus:runtime.tradeMims.vote.status,moneyOpportunityId:runtime.opportunity.opportunityId,purseOpportunityId},
            informationCutoff:runtime.informationCutoff,completedAt:now,
            evidenceIds:[...runtime.evidenceIds,...admitted.opportunityEnvelope.opportunity.evidenceIds],
          }))
          purseRejected+=1
          continue
        }

        const [treasury,capital,portfolio,opportunities,learningProfiles,decisionStyle]=await Promise.all([
          loadCofferTreasurySnapshot(input.client,charter,baseTime),
          loadPurseCapitalEvidence(input.client,charter,baseTime),
          loadLatestPursePortfolio(input.client,charter,baseTime),
          loadAdmittedPurseOpportunities(input.client,charter,baseTime),
          loadPurseLearningProfiles(input.client,charter.userId,baseTime),
          loadPurseDecisionStyle(input.client,charter.userId,baseTime),
        ])
        const plan=allocatePurseCapital({
          charter,treasury,capital,opportunities,
          currentExposures:portfolioExposures(portfolio),
          learningProfiles,
          ...(decisionStyle?{decisionStyle}:{}),
          informationCutoff:baseTime,
          expiresAt:policy.opportunityExpiresAt,
        })
        const decisions=buildPurseDecisionSet({charter,plan,opportunities,decidedAt:baseTime})
        const rebalance=buildPurseRebalancePlan({
          charter,decisions,portfolio,riskDirectives:[],createdAt:baseTime,expiresAt:policy.opportunityExpiresAt,
        })
        await persistPurseCycle(input.client,{charter,plan,decisions,rebalance,portfolio})
        const purseIntent=findPurseIntentForOpportunity({
          rebalance,decisions,opportunityId:purseOpportunityId,
        })

        if(!purseIntent){
          await appendRuntimeRun(input.client,receipt({
            record,charter,disposition:'PURSE_ADMITTED',
            opportunityId:purseOpportunityId,purseBusEventId:admitted.opportunityEnvelope.busEventId,
            allocationPlanId:plan.planId,decisionSetId:decisions.decisionSetId,rebalancePlanId:rebalance.rebalancePlanId,
            runJson:{reasonCodes:['ADMITTED_BUT_NOT_ALLOCATED_IN_CROSS_LANE_COMPETITION'],rejectedOpportunityIds:plan.rejectedOpportunityIds,moneyOpportunityId:runtime.opportunity.opportunityId,purseOpportunityId},
            informationCutoff:baseTime,completedAt:now,
            evidenceIds:[...runtime.evidenceIds,...plan.evidenceIds,...rebalance.evidenceIds],
          }))
          purseAdmitted+=1
          continue
        }

        await appendRuntimeRun(input.client,receipt({
          record,charter,disposition:'ALLOCATED',
          opportunityId:purseOpportunityId,purseBusEventId:admitted.opportunityEnvelope.busEventId,
          allocationPlanId:plan.planId,decisionSetId:decisions.decisionSetId,rebalancePlanId:rebalance.rebalancePlanId,
          runJson:{purseIntentId:purseIntent.intentId,notionalMinor:purseIntent.notionalMinor.toString(),autonomyMode:charter.autonomyMode,moneyOpportunityId:runtime.opportunity.opportunityId,purseOpportunityId},
          informationCutoff:baseTime,completedAt:now,
          evidenceIds:[...runtime.evidenceIds,...plan.evidenceIds,...rebalance.evidenceIds],
        }))
        allocated+=1

        if(charter.autonomyMode!=='LIVE_GOVERNED_INTENTS')continue

        const executionPackage=await loadExecutionPackage(input.client,{
          envelopeId:record.envelope.envelopeId,charterId:charter.charterId,
          opportunityId:purseOpportunityId,rebalancePlanId:rebalance.rebalancePlanId,now,
        })
        if(!executionPackage){deferred+=1;continue}
        if(executionPackage.purseIntentId!==purseIntent.intentId)throw new Error('SHARK_COFFER_RUNTIME_EXECUTION_PACKAGE_PURSE_INTENT_MISMATCH')
        const decidedAt=latest(executionPackage.observedAt,executionPackage.preflight.checkedAt)
        if(Date.parse(decidedAt)>=Date.parse(purseIntent.expiresAt)||Date.parse(decidedAt)>=Date.parse(executionPackage.expiresAt)){deferred+=1;continue}
        const mandate=await loadActiveAutonomousMandate(input.client,{
          userId:charter.userId,provider:executionPackage.preflight.provider,accountId:executionPackage.preflight.accountId,now:decidedAt,
        })
        if(!mandate){deferred+=1;continue}

        const autonomousIntent=buildPurseAutonomousTradeIntent({
          charter,
          opportunityEnvelope:admitted.opportunityEnvelope,
          decisionSet:decisions,
          rebalancePlan:rebalance,
          purseIntent,
          canonicalIntent:executionPackage.canonicalIntent,
          mandate,
          executionPlan:executionPackage.executionPlan,
          preflight:executionPackage.preflight,
          decidedAt,
        })
        await appendAutonomousIntent(input.client,{
          envelopeId:record.envelope.envelopeId,charterId:charter.charterId,
          opportunityId:purseOpportunityId,intent:autonomousIntent,
        })
        await appendRuntimeRun(input.client,receipt({
          record,charter,disposition:'AUTONOMOUS_INTENT_READY',
          opportunityId:purseOpportunityId,purseBusEventId:admitted.opportunityEnvelope.busEventId,
          allocationPlanId:plan.planId,decisionSetId:decisions.decisionSetId,rebalancePlanId:rebalance.rebalancePlanId,
          autonomousIntentId:autonomousIntent.intentId,
          runJson:{executionPackageId:executionPackage.packageId,mandateId:mandate.mandateId,preflightId:executionPackage.preflight.preflightId,canExecute:false},
          informationCutoff:baseTime,completedAt:now,
          evidenceIds:[...runtime.evidenceIds,...autonomousIntent.evidenceIds,...executionPackage.evidenceIds],
        }))
        autonomousIntentReady+=1
      }catch(error){
        const reason=error instanceof Error?error.message:String(error)
        // Missing current Coffer/Purse/execution evidence is retryable. Everything
        // else is surfaced as a bounded failure without granting authority.
        if(/REQUIRED|READ_FAILED|LOAD_FAILED|LIQUIDITY_EVIDENCE_REQUIRED|PORTFOLIO_REQUIRED|TREASURY_EVIDENCE_REQUIRED/.test(reason))deferred+=1
        failures.push({envelopeId:record.envelope.envelopeId,charterId:charter.charterId,reason})
      }
    }
  }

  return Object.freeze({
    scannedIngress:records.length,evaluatedCharterPairs,researchReady,blocked,purseRejected,purseAdmitted,allocated,autonomousIntentReady,deferred,skippedTerminal,
    failures:Object.freeze(failures.map(x=>Object.freeze(x))),
    authority:'RUNTIME_ORCHESTRATION_ONLY',
    canExecute:false,
  })
}
