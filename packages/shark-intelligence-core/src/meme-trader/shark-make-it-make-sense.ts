import {
  assertMakeItMakeSenseCannotAuthorize,
  bindMakeItMakeSenseStage,
  makeItMakeSense,
  type MakeItMakeSenseCheck,
  type MakeItMakeSenseVote,
  type StagedMakeItMakeSenseVote,
} from '@jhadina/core-spine'

export type SharkMakeItMakeSenseStage='HYPOTHESIS'|'TRADE'|'PERFORMANCE'
export type SharkMakeItMakeSenseVote=StagedMakeItMakeSenseVote<SharkMakeItMakeSenseStage>

export function createSharkMakeItMakeSenseVote(input:Readonly<{
  stage:SharkMakeItMakeSenseStage
  voteId:string
  subjectId:string
  checks:readonly MakeItMakeSenseCheck[]
}>):SharkMakeItMakeSenseVote{
  const vote=makeItMakeSense({
    voteId:input.voteId,
    subjectId:input.subjectId,
    checks:input.checks,
  })
  return bindMakeItMakeSenseStage({
    stage:input.stage,
    vote,
    expectedSubjectId:input.subjectId,
  })
}

export function assertSharkMakeItMakeSenseVote(
  staged:SharkMakeItMakeSenseVote,
  expected:Readonly<{stage:SharkMakeItMakeSenseStage;subjectId:string}>,
):void{
  if(staged.stage!==expected.stage)throw new Error('SHARK_MIMS_STAGE_MISMATCH')
  assertMakeItMakeSenseCannotAuthorize(staged.vote)
  if(staged.vote.subjectId!==expected.subjectId)throw new Error('SHARK_MIMS_SUBJECT_MISMATCH')
  if(staged.authority!=='ADVISORY_ONLY'||staged.canAuthorizeAction!==false)throw new Error('SHARK_MIMS_AUTHORITY_ESCALATION_FORBIDDEN')
}

export function sharkMimsEligibility(input:Readonly<{
  vote:MakeItMakeSenseVote
  mode:'PAPER'|'SHADOW'|'LIVE_GOVERNED'
}>):Readonly<{
  eligible:boolean
  reasonCodes:readonly string[]
  authority:'ADVISORY_ONLY'
  canAuthorizeTrade:false
}>{
  assertMakeItMakeSenseCannotAuthorize(input.vote)
  const reasons:string[]=[]
  if(input.vote.status==='FAIL')reasons.push('MIMS_FAILED')
  if(input.mode==='LIVE_GOVERNED'&&input.vote.status!=='PASS')reasons.push('MIMS_PASS_REQUIRED_FOR_LIVE')
  return Object.freeze({
    eligible:reasons.length===0,
    reasonCodes:Object.freeze(reasons),
    authority:'ADVISORY_ONLY',
    canAuthorizeTrade:false,
  })
}
