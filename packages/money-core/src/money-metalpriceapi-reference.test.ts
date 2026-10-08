import test from 'node:test';
import assert from 'node:assert/strict';
import {MetalpriceApiResearchClient,METALPRICE_API_HOST} from './money-metalpriceapi-reference.js';
import type {HttpClient} from './read-only-http-bank-adapter.js';
const receivedAt='2026-10-08T12:05:00Z';
const t=Math.floor(Date.parse('2026-10-08T12:00:00Z')/1000);
function fixture(rates:Record<string,number>={XAU:0.0005,XAG:0.04,XPT:0.001,XPD:0.0012},timestamp=t) {
  const requests:{url:string;headers:Headers}[]=[];
  const fetchImpl:HttpClient=async (input,init)=>{
    requests.push({url:String(input),headers:new Headers(init?.headers)});
    return new Response(JSON.stringify({success:true,base:'USD',timestamp,rates}),
      {status:200,headers:{'X-API-CURRENT':'3','X-API-QUOTA':'100'}});
  };
  const client=new MetalpriceApiResearchClient({key:()=> 'fixture-secret',entitlementEvidenceId:'licensed-contract:fixture',
    fetchImpl});
  return {requests,client};
}
const standard={receivedAt,maxAgeMs:3600000,metals:['XAU','XAG'] as const};
test('FINISH.06 MetalpriceAPI reference uses documented header and inverse troy-oz rates, never execution',async()=>{
  const {requests,client}=fixture();
  const got=await client.readReference(standard);
  assert.equal(got.references[0]?.priceUsdPerTroyOunce,'2000');
  assert.equal(got.references[1]?.priceUsdPerTroyOunce,'25');
  assert.equal(got.references[0]?.unit,'TROY_OUNCE');
  assert.equal(got.references[0]?.observationKind,'NON_EXECUTABLE_MIDPOINT');
  assert.equal(got.references[0]?.availableAt,receivedAt);
  assert.equal(got.canExecute,false);
  assert.equal(got.quota.current,3);
  assert.ok(requests[0]?.url.startsWith(METALPRICE_API_HOST+'/v1/latest'));
  assert.ok(!requests[0]?.url.includes('fixture-secret'));
  assert.equal(requests[0]?.headers.get('X-API-KEY'),'fixture-secret');
});
test('FINISH.06 stale/future/inconsistent reference must fail closed',async()=>{
  await assert.rejects(()=>fixture().client.readReference({...standard,maxAgeMs:1000}),/STALE/);
  await assert.rejects(()=>fixture({XAU:0.0005},t+7200).client.readReference({...standard,metals:['XAU']}),/FUTURE/);
  await assert.rejects(()=>fixture({XAU:0.0005,USDXAU:3000}).client.readReference({...standard,metals:['XAU']}),/RECIPROCAL_CONFLICT/);
  await assert.rejects(()=>fixture({XAU:0}).client.readReference({...standard,metals:['XAU']}),/MISSING_METAL_RATE/);
  const noLicense=new MetalpriceApiResearchClient({key:()=> 'secret',entitlementEvidenceId:'',fetchImpl:fixture().client['readReference'] as never});
  await assert.rejects(()=>noLicense.readReference(standard),/LICENSE_NOT_VERIFIED/);
});
test('FINISH.06 historical rates must not be backdated into research availability',async()=>{
  const {requests,client}=fixture();
  const got=await client.readReference({...standard,historicalDate:'2026-10-07'});
  assert.equal(got.endpoint,'HISTORICAL_DAY');
  assert.equal(got.references[0]?.availableAt,receivedAt);
  assert.ok(requests[0]?.url.includes('/v1/2026-10-07?'));
  await assert.rejects(()=>client.readReference({...standard,historicalDate:'2027-01-01'}),/HISTORICAL_DATE_INVALID/);
});
test('FINISH.06 enforces HTTPS base URL before credentials',()=>{
  assert.throws(()=>new MetalpriceApiResearchClient({key:()=> 'k',entitlementEvidenceId:'test',baseUrl:'http://example.com'}),/HTTPS_OR_URL_INVALID/);
  assert.throws(()=>new MetalpriceApiResearchClient({key:()=> 'k',entitlementEvidenceId:'test',baseUrl:'https://credential-stealing.example.com'}),/HTTPS_OR_URL_INVALID/);
});
