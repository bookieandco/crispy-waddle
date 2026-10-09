import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySharkSalvage,admitReconstructedMarket,planFreshShadowHistory,
  type SalvageArtifact,type HistoricalMarket} from './shark-history-salvage.js';
const at='2026-10-08T00:00:00Z';
const make=(kind:SalvageArtifact['kind'],id:string=kind):SalvageArtifact=>({
 id,kind,origin:'GITHUB_ACTIONS',sourceRef:'ci:37815361377',
 sha256:'a'.repeat(64),bytes:200,discoveredAt:at,
});
test('salvage never claims original recovery even for matching original filename',()=>{
 const x=classifySharkSalvage([make('ORIGINAL_DB_CANDIDATE','shadow-pg.dump')]);
 assert.equal(x.entries[0]?.disposition,'ORIGINAL_UNVERIFIED');
 assert.equal(x.originalRestored,false);
 assert.equal(x.entries[0]?.mayUpdateForwardLearning,false);
 assert.equal(x.canAuthorizeLive,false);
});
test('synthetic marker overrides an artifact claiming to be original',()=>{
 const x=classifySharkSalvage([make('ORIGINAL_EXPORT_CANDIDATE','shadow-synthetic-fixture')]);
 assert.equal(x.entries[0]?.disposition,'SYNTHETIC_EXCLUDED');
});
test('CI logs are not market data; provider archive is never forward learning',()=>{
 const x=classifySharkSalvage([make('CI_INVENTORY'),make('MARKET_ARCHIVE')]);
 assert.equal(x.entries[0]?.disposition,'NON_LEDGER_EVIDENCE');
 assert.equal(x.entries[1]?.disposition,'RECONSTRUCTED_RESEARCH_ONLY');
 assert.ok(x.entries.every(y=>!y.originalRestored&&!y.canExecute));
});
test('repeated identical candidate is idempotent; contradictory digest fails',()=>{
 const c=make('ORIGINAL_DB_CANDIDATE','same');
 assert.equal(classifySharkSalvage([c,c]).entries.length,1);
 assert.throws(()=>classifySharkSalvage([c,{...c,sha256:'b'.repeat(64)}]),/ID_CONFLICT/);
});
test('same artifact re-discovered later does not change manifest hash or conflict',()=>{
 const a=make('ORIGINAL_DB_CANDIDATE','old-shadow');
 const later={...a,discoveredAt:'2026-10-09T01:00:00Z'};
 const one=classifySharkSalvage([a]);
 const multi=classifySharkSalvage([later,a]);
 assert.equal(multi.entries.length,1);
 assert.equal(multi.entries[0]?.discoveredAt,a.discoveredAt);
 assert.equal(multi.manifestHash,one.manifestHash);
});

test('inventory order is canonical, metadata tampering changes digest',()=>{
 const a=make('HANDOFF','a'),b=make('CI_INVENTORY','b');
 const first=classifySharkSalvage([a,b]);
 assert.equal(first.manifestHash,classifySharkSalvage([b,a]).manifestHash);
 assert.notEqual(first.manifestHash,classifySharkSalvage([a,{...b,bytes:300}]).manifestHash);
});
test('invalid bytes, missing digest and missing evidence are blocked',()=>{
 for(const c of [{...make('HANDOFF'),bytes:-1},{...make('HANDOFF'),sha256:'bad'},
   {...make('HANDOFF'),sourceRef:''}]){
  assert.throws(()=>classifySharkSalvage([c]),/INPUT_INVALID/);
 }
});
const market:HistoricalMarket={token:'mint',pair:'pair',source:'archived-provider',
 sha256:'c'.repeat(64),priceUsd:.01,eventAt:'2026-10-01T00:00:00Z',
 availableAt:'2026-10-01T00:01:00Z',capturedAt:'2026-10-08T00:00:00Z',
 hypotheticalDecisionAt:'2026-10-01T00:02:00Z'};
test('even point-in-time archived market data is retrospective, never original decisions',()=>{
 const x=admitReconstructedMarket(market);
 assert.equal(x.disposition,'RESEARCH_ONLY');
 assert.equal(x.reason,'RETROSPECTIVE_ONLY');
 assert.equal(x.originalDecisionCreated,false);
 assert.equal(x.forwardLearningAllowed,false);
});
test('future market data and impossible availability chronology are rejected',()=>{
 assert.equal(admitReconstructedMarket({...market,availableAt:'2026-10-01T00:10:00Z'}).reason,'FUTURE_INFORMATION');
 assert.equal(admitReconstructedMarket({...market,availableAt:'2026-09-29T00:00:00Z'}).reason,'SOURCE_CLOCK_CONFLICT');
 assert.throws(()=>admitReconstructedMarket({...market,priceUsd:0}),/MARKET_INVALID/);
});
const start={originalStatus:'UNAVAILABLE' as const,originalRoot:'/mnt/original-shadow',
 newRoot:'/mnt/new-shadow-paper',approved:true,ownerHostVerified:true,
 mountVerified:true,encryptedOffsiteRestoreVerified:true,paperOnly:true};
test('fresh ledger never provisions or certifies even when declared gates pass',()=>{
 const x=planFreshShadowHistory(start);
 assert.equal(x.state,'OPERATOR_REVIEW_ONLY');
 assert.equal(x.label,'NEW_HISTORY_NOT_RECOVERED');
 assert.equal(x.createsRuntime,false);
 assert.equal(x.originalOverwritten,false);
 assert.equal(x.canExecute,false);
});
test('fresh ledger blocks nested roots and absent durable/backup/owner gates',()=>{
 for(const newRoot of ['/mnt/original-shadow','/mnt/original-shadow/nested',
  '/mnt','/']){
  assert.equal(planFreshShadowHistory({...start,newRoot}).state,'BLOCKED');
 }
 const x=planFreshShadowHistory({...start,approved:false,mountVerified:false,
  encryptedOffsiteRestoreVerified:false,ownerHostVerified:false,paperOnly:false});
 assert.equal(x.state,'BLOCKED');
 assert.ok(x.blockers.includes('DURABLE_MOUNT_UNVERIFIED'));
 assert.ok(x.blockers.includes('PAPER_AUTHORITY_REQUIRED'));
});
test('synthetic restore or pending external certification cannot trigger fresh start',()=>{
 for(const originalStatus of ['SYNTHETIC_ONLY','EXTERNAL_CERTIFICATION_PENDING'] as const){
  assert.equal(planFreshShadowHistory({...start,originalStatus}).state,'BLOCKED');
 }
});
