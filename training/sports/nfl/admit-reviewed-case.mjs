#!/usr/bin/env node
/**
 * Case #001 integrity -> official result scoring -> reviewed lesson CANDIDATE.
 * Does not teach a deployed model, modify memory, or execute a wager.
 * Never use this for live game observations or unreviewed provisional scores.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {verifyCase001} from './verify-case.mjs';
import {gradeSportsStudyCase} from './grade-case.mjs';
import {compileJhadinaSportsLearningCandidate} from './compile-lessons.mjs';

const digest=(s)=>createHash('sha256').update(s).digest('hex');
const officialDomains=new Set(['nfl.com','www.nfl.com','buffalobills.com','www.buffalobills.com','therams.com','www.therams.com']);

export function admitReviewedCase001({pregameBytes,availabilityBytes,final,scorecard,review}) {
  const lineage=verifyCase001(pregameBytes,availabilityBytes);
  const pregame=JSON.parse(pregameBytes.toString('utf8'));
  if(final?.status!=='FINAL'||final?.source_class!=='OFFICIAL_FINAL')throw new Error('NOT_AN_OFFICIAL_FINAL_RESULT');
  let url;
  try{url=new URL(final.source_url);}catch{throw new Error('OFFICIAL_RESULT_URL_INVALID')}
  if(url.protocol!=='https:'||!officialDomains.has(url.hostname.toLowerCase()))throw new Error('OFFICIAL_RESULT_HOST_UNTRUSTED');
  const expected=gradeSportsStudyCase(pregame,final);
  if(JSON.stringify(expected)!==JSON.stringify(scorecard))throw new Error('SCORECARD_NOT_DERIVED_FROM_LOCKED_FORECAST');
  if(!Array.isArray(review?.evidence_items)||!review.evidence_items.some(e=>e.source_url===final.source_url)){
    throw new Error('REVIEW_MISSING_OFFICIAL_RESULT_LINEAGE');
  }
  const candidate=compileJhadinaSportsLearningCandidate(pregame,expected,review);
  if(candidate.training_status!=='AWAITING_OWNER_REVIEW'||candidate.canTrainAutomatically!==false||candidate.canExecute!==false){
    throw new Error('TRAINING_AUTHORITY_ESCALATION');
  }
  return Object.freeze({
    schema_version:'jhadina.sports.review_admission_receipt.v1',
    case_id:pregame.case_id,
    event_id:pregame.event_id,
    pregame_source_commit:lineage.sourceCommit,
    pregame_original_git_blob_sha:lineage.originalGitBlobSha,
    source_sha256:{
      pregame:digest(pregameBytes),
      availability:digest(availabilityBytes),
      final:digest(JSON.stringify(final)),
      scorecard:digest(JSON.stringify(expected)),
      review:digest(JSON.stringify(review))
    },
    official_final_source:final.source_url,
    candidate,
    admission_status:'REVIEWED_CANDIDATE_AWAITING_OWNER_APPROVAL',
    durable_memory_saved:false,
    weights_updated:false,
    sample_size:1,
    training_authority:'NONE',
    canExecute:false
  });
}

const isMain=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(isMain){
  const [pregame,availability,finalPath,scorePath,reviewPath,outPath]=process.argv.slice(2);
  if(!pregame||!availability||!finalPath||!scorePath||!reviewPath){
    console.error('Usage: node admit-reviewed-case.mjs PREGAME AVAILABILITY OFFICIAL_FINAL SCORECARD REVIEW [OUTPUT]');
    process.exitCode=2;
  }else{
    try{
      const receipt=admitReviewedCase001({
        pregameBytes:readFileSync(pregame),
        availabilityBytes:readFileSync(availability),
        final:JSON.parse(readFileSync(finalPath,'utf8')),
        scorecard:JSON.parse(readFileSync(scorePath,'utf8')),
        review:JSON.parse(readFileSync(reviewPath,'utf8'))
      });
      const output=JSON.stringify(receipt,null,2)+'\n';
      if(outPath)writeFileSync(outPath,output,{flag:'wx'});
      else process.stdout.write(output);
    }catch(error){
      console.error(error instanceof Error?error.message:String(error));
      process.exitCode=1;
    }
  }
}
