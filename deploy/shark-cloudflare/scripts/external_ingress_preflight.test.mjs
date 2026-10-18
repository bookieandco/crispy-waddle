import test from "node:test";
import assert from "node:assert/strict";
import {completePage,checkCustomDomains,checkZones,
  checkZoneRoutes,readIngressInventory} from "./external_ingress_preflight.mjs";
const A="0123456789abcdef0123456789abcdef";
const Z="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TOKEN="SYNTHETIC_TEST_TOKEN_NOT_A_REAL_SECRET";
const info=n=>({page:1,total_pages:1,total_count:n});
const domains=result=>({success:true,result,result_info:info(result.length)});
const zones=result=>({success:true,result,result_info:info(result.length)});
const routes=result=>({success:true,result});
const response=data=>({ok:true,json:async()=>data});
test("pagination refuses missing, second page, mismatched totals",()=>{
  assert.throws(()=>completePage(null,0));
  assert.throws(()=>completePage({page:1,total_pages:2,total_count:4},4));
  assert.throws(()=>completePage({page:2,total_pages:2,total_count:0},0));
  assert.throws(()=>completePage(info(2),1));
});
test("domain inventory is exact script scoped, rejects all attached SHARK domains",()=>{
  assert.equal(checkCustomDomains(domains([
    {service:"pupsonstuff",enabled:true,hostname:"example.com"},
  ])).matchingCustomDomains,0);
  assert.throws(()=>checkCustomDomains(domains([{service:"jhadina-shark-public-free",enabled:false}])));
  assert.throws(()=>checkCustomDomains(domains([{service:"jhadina-shark-public-free",previews_enabled:true}])));
  assert.throws(()=>checkCustomDomains({success:false,result:[]}));
  assert.throws(()=>checkCustomDomains({success:true,result:[{service:undefined}]}));
  assert.throws(()=>checkCustomDomains({success:true,result:[],
    result_info:{page:1,total_pages:2,total_count:0}}));
});
test("zone visibility is bounded and account scoped",()=>{
  assert.deepEqual(checkZones(zones([{id:Z,account:{id:A}}]),A),[Z]);
  assert.throws(()=>checkZones(zones([{id:Z,account:{id:"b".repeat(32)}}]),A));
  assert.throws(()=>checkZones(zones([{id:Z,account:{id:A}},{id:Z,account:{id:A}}]),A));
  assert.throws(()=>checkZones({success:true,result:[]},A));
  assert.throws(()=>checkZones(zones(Array.from({length:21},(_,i)=>({
    id:i.toString(16).padStart(32,"0"),account:{id:A}
  }))),A));
});
test("zone route check is exact script scoped, conservative about unknown route shapes",()=>{
  assert.equal(checkZoneRoutes(routes([{id:"route-a",script:"pupsonstuff"}])).matchingRoutes,0);
  assert.throws(()=>checkZoneRoutes(routes([{id:"route-b",script:"jhadina-shark-public-free"}])));
  assert.throws(()=>checkZoneRoutes(routes([{}])));
  assert.throws(()=>checkZoneRoutes({success:false,result:[]}));
});
test("remote reader uses ONLY GET on full token-visible inventory",async()=>{
  const calls=[];
  const fetcher=async(url,opts)=>{
    calls.push({url,method:opts.method});
    if(url.endsWith("/workers/domains")) return response(domains([]));
    if(url.includes("/zones?")) return response(zones([{id:Z,account:{id:A}}]));
    if(url.endsWith("/workers/routes")) return response(routes([{id:"other",script:"pupsonstuff"}]));
    throw Error("unexpected URL");
  };
  const result=await readIngressInventory(A,TOKEN,fetcher);
  assert.equal(result.visibleZonesChecked,1);
  assert.equal(result.allAccountZonesAttested,false);
  assert.equal(result.cronAuthorized,false);
  assert.equal(result.collectionAuthorized,false);
  assert.equal(result.canTrade,false);
  assert.equal(calls.length,3);
  assert.ok(calls.every(x=>x.method==="GET"));
  assert.equal(calls[0].url,"https://api.cloudflare.com/client/v4/accounts/"+A+"/workers/domains");
  assert.equal(calls[1].url,"https://api.cloudflare.com/client/v4/zones?account.id="+A+"&per_page=50&page=1");
});
test("read-only inventory does not accept token with hidden zones or SHARK route",async()=>{
  await assert.rejects(readIngressInventory(A,"",async()=>{throw Error("bad");}));
  await assert.rejects(readIngressInventory(A,TOKEN,async(url)=>{
    return response(url.endsWith("/workers/domains")?domains([]):{success:true,result:[]});
  }));
  await assert.rejects(readIngressInventory(A,TOKEN,async(url)=>{
    if(url.endsWith("/workers/domains"))return response(domains([]));
    if(url.includes("/zones?"))return response(zones([{id:Z,account:{id:A}}]));
    return response(routes([{id:"some-route",script:"jhadina-shark-public-free"}]));
  }));
});
