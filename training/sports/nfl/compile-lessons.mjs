/**
 * Jhadina case-study -> governed learning candidate.
 * Deliberately does not write to memory, modify weights, create bets, or authorize actions.
 * Only a human/owner-reviewed research note may be admitted later by JANET.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const hash=(x)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const instant=(value,label)=>{
 const d=Date.parse(value);
 if(!Number.isFinite(d))throw new Error(label+'_INVALID');
 return d;
};
const nonempty=(value,label)=>{
 if(typeof value!=='string'||!value.trim())throw new Error(label+'_REQUIRED');
 return value.trim();
};
const allowed=new Set(['SUPPORTED','MIXED','CONTRADICTED','INSUFFICIENT_EVIDENCE']);
export function compileJhadinaSportsLearningCandidate(pregame,scorecard,review){
 if(pregame?.schema_version!=='jhadina.sports.study_case.pregame.v1')throw new Error('CASE_SCHEMA_INVALID');
 if(scorecard?.schema_version!=='jhadina.sports.study_case.scorecard.v1')throw new Error('SCORECARD_SCHEMA_INVALID');
 if(review?.schema_version!=='jhadina.sports.study_case.review.v1')throw new Error('REVIEW_SCHEMA_INVALID');
 if(![scorecard,review].every(x=>x.case_id===pregame.case_id&&x.event_id===pregame.event_id))throw new Error('CASE_EVENT_MISMATCH');
 if(scorecard.calibrated!==false||scorecard.sample_size!==1||scorecard.canExecute!==false||scorecard.original_prediction_unchanged!==true)throw new Error('SCORECARD_GOVERNANCE_INVALID');
 if(scorecard.training_status!=='AWAITING_EVIDENCE_REVIEW')throw new Error('SCORECARD_STATE_INVALID');
 if(pregame.governance?.canExecute!==false||pregame.governance?.canAuthorizeBet!==false)throw new Error('CASE_AUTHORITY_INVALID');
 const cutoff=instant(pregame.matchup.scheduled_kickoff_utc,'KICKOFF');
 const verified=instant(scorecard.verified_final_at_utc,'FINAL');
 const reviewed=instant(review.reviewed_at_utc,'REVIEW');
 if(verified<=cutoff||reviewed<verified)throw new Error('REVIEW_CLOCK_INVALID');
 nonempty(review.reviewer_id,'REVIEWER');
 if(!Array.isArray(review.evidence_items)||!Array.isArray(review.hypothesis_reviews))throw new Error('REVIEW_EVIDENCE_REQUIRED');
 const evidence=new Map();
 for(const e of review.evidence_items){
  const id=nonempty(e.evidence_id,'EVIDENCE_ID');
  if(evidence.has(id))throw new Error('DUPLICATE_EVIDENCE_ID');
  if(!/^https:\/\//.test(e.source_url||''))throw new Error('EVIDENCE_SOURCE_INVALID');
  if(instant(e.available_at_utc,'EVIDENCE_AVAILABLE')>reviewed)throw new Error('FUTURE_EVIDENCE');
  if(instant(e.observed_at_utc,'EVIDENCE_OBSERVED')>instant(e.available_at_utc,'EVIDENCE_AVAILABLE'))throw new Error('EVIDENCE_OBSERVATION_AFTER_AVAILABILITY');
  nonempty(e.claim,'EVIDENCE_CLAIM');
  evidence.set(id,e);
 }
 const requiredIds=new Set(pregame.thesis.map(x=>x.id));
 if(!requiredIds.size||requiredIds.size!==pregame.thesis.length)throw new Error('DUPLICATE_PREGAME_HYPOTHESIS');
 if(review.hypothesis_reviews.length!==requiredIds.size)throw new Error('INCOMPLETE_HYPOTHESIS_REVIEW');
 const seen=new Set();
 const hypotheses=review.hypothesis_reviews.map(r=>{
  if(!requiredIds.has(r.hypothesis_id)||seen.has(r.hypothesis_id))throw new Error('UNKNOWN_OR_DUPLICATE_HYPOTHESIS');
  seen.add(r.hypothesis_id);
  if(!allowed.has(r.status))throw new Error('HYPOTHESIS_VERDICT_INVALID');
  nonempty(r.rationale,'HYPOTHESIS_RATIONALE');
  if(!Array.isArray(r.evidence_ids))throw new Error('HYPOTHESIS_EVIDENCE_REQUIRED');
  if(r.status!=='INSUFFICIENT_EVIDENCE'&&r.evidence_ids.length===0)throw new Error('SUPPORTED_WITHOUT_EVIDENCE');
  for(const id of r.evidence_ids)if(!evidence.has(id))throw new Error('HYPOTHESIS_UNLINKED_EVIDENCE');
  return {
   id:r.hypothesis_id,status:r.status,rationale:r.rationale,evidenceIds:[...new Set(r.evidence_ids)].sort(),
   limitation:r.limitation||'The observed result alone does not prove causation.'
  };
 });
 const lessons=(review.lessons||[]).map(l=>{
   nonempty(l.statement,'LESSON_STATEMENT');
   if(!['OBSERVATION','HYPOTHESIS','CANDIDATE_RULE'].includes(l.kind))throw new Error('LESSON_KIND_INVALID');
   if(!Array.isArray(l.evidence_ids))throw new Error('LESSON_EVIDENCE_REQUIRED');
   for(const id of l.evidence_ids)if(!evidence.has(id))throw new Error('LESSON_UNLINKED_EVIDENCE');
   if(l.kind==='CANDIDATE_RULE'&&!l.evidence_ids.length)throw new Error('RULE_WITHOUT_EVIDENCE');
   return {statement:l.statement,kind:l.kind,evidenceIds:[...new Set(l.evidence_ids)].sort(),canBePromotedAutomatically:false};
 });
 const fingerprint=hash({caseId:pregame.case_id,grade:scorecard.assessment,hypotheses,lessons,evidenceIds:[...evidence.keys()].sort()});
 return Object.freeze({
  schema_version:'jhadina.sports.learning_candidate.v1',
  candidate_id:'sports-learning-candidate:'+fingerprint,
  case_id:pregame.case_id,
  event_id:pregame.event_id,
  model_id:pregame.original_prediction.model_id,
  model_version:pregame.original_prediction.model_version,
  verified_final_at_utc:scorecard.verified_final_at_utc,
  reviewed_at_utc:review.reviewed_at_utc,
  original_forecast:{winner:pregame.original_prediction.winner,homeWinProbability:pregame.original_prediction.home_win_probability,
   homePoints:pregame.original_prediction.home_projected_points,awayPoints:pregame.original_prediction.away_projected_points},
  evaluation:scorecard.assessment,
  hypotheses,lessons,
  evidence:review.evidence_items,
  reasoning_vote:{
   makes_internal_sense:review.reasoning_vote?.makes_internal_sense??null,
   supported_by_verified_evidence:review.reasoning_vote?.supported_by_verified_evidence??null,
   remaining_contradictions:review.reasoning_vote?.remaining_contradictions??[],
   note:'Coherence and truth are separate dimensions.'
  },
  sample_size:1,
  model_calibrated:false,
  training_status:'AWAITING_OWNER_REVIEW',
  proposed_memory_type:'SPORTS_RESEARCH_EPISODE',
  authority:'LEARNING_CANDIDATE_ONLY',
  canTrainAutomatically:false,
  canAuthorizeLive:false,
  canExecute:false
 });
}
const main=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(main){
 const [p,s,r,out]=process.argv.slice(2);
 if(!p||!s||!r){console.error('Usage: node compile-lessons.mjs PREGAME SCORECARD REVIEW [OUT]');process.exitCode=2}
 else {
  try{
   const result=JSON.stringify(compileJhadinaSportsLearningCandidate(
    JSON.parse(readFileSync(p,'utf8')),JSON.parse(readFileSync(s,'utf8')),JSON.parse(readFileSync(r,'utf8'))
   ),null,2)+'\n';
   if(out)writeFileSync(out,result,{flag:'wx'});else process.stdout.write(result);
  }catch(e){console.error(e.message);process.exitCode=1}
 }
}
