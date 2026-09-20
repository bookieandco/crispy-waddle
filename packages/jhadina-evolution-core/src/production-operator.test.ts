import{describe,it}from'node:test';import assert from'node:assert/strict';import{authorizeProduction,builder615Drill,domainPlan,evaluateReadiness,executeDeployment,freezeRelease,migrationPlan,previewDeployment,productionIncident,productionReceipt,resolveProvider,rollbackPlan,routeProductionIntent,secretRequirement,targetEnvironment,verifyProduction}from'./production-operator.js';
const ready=()=>evaluateReadiness({testsExecuted:true,regressionsPassed:true,securityPassed:true,migrationsReady:true,environmentReady:true,secretsReady:true,rollbackReady:true,acceptanceReceipts:['acceptance']});
describe('BUILDER.6.1-6.15',()=>{
it('6.1 routes production intent',()=>assert.equal(routeProductionIntent('rollback this release'),'rollback'));
it('6.2 production target must be explicit',()=>assert.throws(()=>targetEnvironment('production',false)));
it('6.3 reuses evidenced provider',()=>assert.equal(resolveProvider('vercel',['existing-config']).existing,true));
it('6.4 secret values are never exposed',()=>assert.equal(secretRequirement('API_KEY',true).valueExposed,false));
it('6.5 migration starts unauthorized and unverified',()=>assert.equal(migrationPlan('m1',['001.sql']).productionAuthorized,false));
it('6.6 preview is distinct from production',()=>assert.equal(previewDeployment({id:'p',provider:'vercel',commit:'c',evidenceRefs:['e'],status:'ready'}).environment,'preview'));
it('6.7 readiness requires every production proof',()=>assert.equal(ready().ready,true));
it('6.8 domain operations are explicit and unauthorized by default',()=>assert.equal(domainPlan('example.com').authorized,false));
it('6.9 release manifest freezes commit and evidence',()=>assert.equal(freezeRelease({id:'r',commit:'c',projectId:'p',testReceiptRefs:['t'],migrationIds:[],configurationVersion:'v1',previewDeploymentId:'d'}).frozen,true));
it('6.10 production authorization requires approval evidence',()=>assert.equal(authorizeProduction('r').approved,false));
it('6.11 deployment request is not deployment success',()=>{const r=freezeRelease({id:'r',commit:'c',projectId:'p',testReceiptRefs:['t'],migrationIds:[],configurationVersion:'v1',previewDeploymentId:'d'});assert.equal(executeDeployment({release:r,authorization:authorizeProduction('r','human'),provider:'vercel',deploymentId:'prod',evidenceRefs:['provider']}).status,'requested')});
it('6.12 verifies actual production smoke evidence',()=>assert.equal(verifyProduction('prod',[{target:'/',passed:true,evidenceRef:'smoke'}],[]).healthy,true));
it('6.13 production incident forbids live edits',()=>assert.equal(productionIncident('prod',['error']).liveEditAllowed,false));
it('6.14 rollback considers database compatibility and remains gated',()=>assert.equal(rollbackPlan('bad','good',true).authorized,false));
it('6.15 full drill separates preview, approval, deploy and healthy state',()=>{const preview=previewDeployment({id:'preview',provider:'vercel',commit:'c',evidenceRefs:['preview-evidence'],status:'ready'});const gated=builder615Drill({commit:'c',projectId:'p',preview,readiness:ready()});assert.equal(gated.state,'awaiting_approval');const prod={id:'prod',environment:'production' as const,provider:'vercel',commit:'c',status:'ready' as const,evidenceRefs:['provider-ready']};const live=builder615Drill({commit:'c',projectId:'p',preview,readiness:ready(),approvalRef:'human-approval',production:prod,smokes:[{target:'/',passed:true,evidenceRef:'smoke'}]});assert.equal(live.state,'deployed_healthy');const failed=productionReceipt({release:live.release,deployment:prod,health:verifyProduction('prod',[{target:'/api',passed:false,evidenceRef:'smoke-fail'}],[])});assert.equal(failed.state,'rollback_required');assert.equal(failed.incident?.repairBranchRequired,true);});
});
