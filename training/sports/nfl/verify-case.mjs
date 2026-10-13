#!/usr/bin/env node
/**
 * Assert immutable Week 5 NFL pregame case lineage before any grading/learning.
 * These checks are intentionally narrower than statistical evaluation.
 * They prevent accidental historical rewrites and obvious clock leakage.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

export const CASE001 = Object.freeze({
  caseId:'JH-SPORTS-NFL-2026-001',
  eventId:'nfl-2026-reg-week05-buf-at-lar',
  blobSha:'78957b73845b8f93bb162ae52df4de28ecd18725',
  sealCommit:'5b6e6cb7ba799d36b437735fe498b128e3f6a74c',
  originalScoreHome:31,
  originalScoreAway:27,
  originalHomeProbability:0.60,
});

const caseUrl = new URL('./2026/2026-10-12-buf-at-lar/pregame.case.json', import.meta.url);
const availabilityUrl = new URL('./2026/2026-10-12-buf-at-lar/pregame.availability-001.json',import.meta.url);
const parseInstant = (v,n) => {
  const t=Date.parse(v);
  assert.ok(Number.isFinite(t), n+'_INVALID');
  return t;
};
const gitBlobSha = (bytes) => createHash('sha1')
  .update('blob '+bytes.length+'\0')
  .update(bytes).digest('hex');

export function verifyCase001(caseBytes,availabilityBytes) {
  // This SHA refers to a real, independently pinned GitHub blob (not a new
  // prediction inferred after kickoff). Don't replace the SHA on ordinary edits.
  assert.equal(gitBlobSha(caseBytes),CASE001.blobSha,'PREGAME_BLOB_CHANGED');
  const p=JSON.parse(caseBytes.toString('utf8'));
  const a=JSON.parse(availabilityBytes.toString('utf8'));
  assert.equal(p.schema_version,'jhadina.sports.study_case.pregame.v1');
  assert.equal(p.case_id,CASE001.caseId);
  assert.equal(p.event_id,CASE001.eventId);
  assert.equal(p.season,2026);
  assert.equal(p.week,5);
  const kickoff=parseInstant(p.matchup.scheduled_kickoff_utc,'KICKOFF');
  const captured=parseInstant(p.provenance.first_durable_capture,'CAPTURE');
  assert.ok(captured<kickoff,'PREGAME_CAPTURE_AFTER_KICKOFF');
  assert.equal(p.provenance.original_issued_at,null,'ORIGINAL_CHAT_ISSUE_TIME_NOT_VERIFIED');
  assert.equal(p.original_prediction.winner,'LAR');
  assert.equal(p.original_prediction.home_projected_points,CASE001.originalScoreHome);
  assert.equal(p.original_prediction.away_projected_points,CASE001.originalScoreAway);
  assert.equal(p.original_prediction.home_win_probability,CASE001.originalHomeProbability);
  assert.equal(p.original_prediction.calibrated,false);
  assert.equal(p.outcome.status,'PENDING');
  assert.equal(p.governance.canExecute,false);
  assert.equal(p.governance.canAuthorizeBet,false);
  assert.equal(a.case_id,CASE001.caseId);
  assert.equal(a.event_id,CASE001.eventId);
  assert.equal(a.phase,'PREGAME_EVIDENCE_ONLY');
  assert.ok(parseInstant(a.information_cutoff_utc,'AS_OF')<kickoff,'PREGAME_EVIDENCE_AFTER_KICKOFF');
  assert.equal(a.never_edit_original_prediction,true);
  assert.equal(a.recommended_action,'NO_BET');
  assert.ok(a.evidence.length>=1);
  for(const [i,e] of a.evidence.entries()){
    assert.ok(e.fact && /^https:\/\//.test(e.source_url||''),'EVIDENCE_SOURCE_MISSING:'+i);
  }
  return Object.freeze({
    ok:true,caseId:p.case_id,sourceCommit:CASE001.sealCommit,
    originalGitBlobSha:CASE001.blobSha, 
    pregameCapturedAt:p.provenance.first_durable_capture,
    evidenceCutoff:a.information_cutoff_utc,
    kickoff:p.matchup.scheduled_kickoff_utc,
    noBetAuthority:true
  });
}
const invoked = process.argv[1] && new URL('file://'+process.argv[1]).pathname === new URL(import.meta.url).pathname;
if(invoked){
  try{
    const report=verifyCase001(readFileSync(caseUrl),readFileSync(availabilityUrl));
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
  }catch(err){
    console.error(err instanceof Error?err.message:String(err));
    process.exitCode=1;
  }
}
