#!/usr/bin/env node
/**
 * SHARK-CLOUDFLARE.LIVE.14–.16
 * Cloudflare READ-ONLY route/domain inventory for the exact SHARK script.
 * This can only certify the account/zone inventory visible to the scoped
 * token at the time of the requests; it is NOT a global account attestation.
 * Never enumerates private content or alters Cloudflare configuration.
 */
import {parseArgs} from "node:util";
const ACCT=/^[0-9a-f]{32}$/;
const DBID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const SCRIPT="jhadina-shark-public-free";
const MAX_ZONES=20;
const MAX_ROUTES=1000;
const MAX_DOMAINS=1000;
const ROOT="https://api.cloudflare.com/client/v4";
export function completePage(resultInfo, actualCount, {allowAbsent=false}={}) {
  if(resultInfo==null) {
    if(allowAbsent) return true; // officially non-paginated routes/domains
    throw Error("INGRESS_INVENTORY_PAGINATION_UNATTESTED");
  }
  const x=resultInfo;
  if(!Number.isInteger(x.page)||x.page!==1||
     !Number.isInteger(x.total_pages)||x.total_pages!==1||
     !Number.isInteger(x.total_count)||x.total_count!==actualCount)
    throw Error("INGRESS_INVENTORY_INCOMPLETE_OR_FILTERED");
  return true;
}
export function checkCustomDomains(payload) {
  if(payload?.success!==true || !Array.isArray(payload.result) ||
     payload.result.length>MAX_DOMAINS)
    throw Error("CLOUDFLARE_CUSTOM_DOMAINS_UNREADABLE");
  completePage(payload.result_info,payload.result.length,{allowAbsent:true});
  for(const d of payload.result) {
    if(!d || typeof d.service!=="string")
      throw Error("CLOUDFLARE_DOMAIN_IDENTITY_UNKNOWN");
    if(d.service===SCRIPT) throw Error("SHARK_CUSTOM_DOMAIN_ATTACHED");
  }
  return {matchingCustomDomains:0,tokenVisibleCustomDomainInventoryChecked:true};
}
export function checkZones(payload,accountId) {
  if(payload?.success!==true || !Array.isArray(payload.result) ||
     payload.result.length>MAX_ZONES)
    throw Error("CLOUDFLARE_ZONES_UNREADABLE_OR_TOO_MANY");
  completePage(payload.result_info,payload.result.length);
  const seen=new Set();
  for(const z of payload.result) {
    if(!z || !/^[0-9a-f]{32}$/.test(z.id||"") ||
       z.account?.id!==accountId || seen.has(z.id))
      throw Error("CLOUDFLARE_ZONE_SCOPE_UNVERIFIED");
    seen.add(z.id);
  }
  return [...seen];
}
export function checkZoneRoutes(payload) {
  if(payload?.success!==true || !Array.isArray(payload.result) ||
     payload.result.length>MAX_ROUTES)
    throw Error("CLOUDFLARE_ZONE_ROUTES_UNREADABLE");
  completePage(payload.result_info,payload.result.length,{allowAbsent:true});
  for(const route of payload.result) {
    if(!route || typeof route.id!=="string" ||
       !(route.script==null || typeof route.script==="string"))
      throw Error("CLOUDFLARE_ZONE_ROUTE_UNVERIFIED");
    if(route.script===SCRIPT) throw Error("SHARK_ZONE_ROUTE_ATTACHED");
  }
  return {matchingRoutes:0};
}
async function apiGET(url,token,fetcher) {
  const response=await fetcher(url,{method:"GET",redirect:"error",
    signal:AbortSignal.timeout(9000),
    headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
  if(!response?.ok) throw Error("SHARK_ROUTE_READ_REFUSED");
  const payload=await response.json();
  if(payload?.success!==true) throw Error("SHARK_ROUTE_READ_UNVERIFIED");
  return payload;
}
export async function readIngressInventory(accountId,token,fetcher=fetch) {
  if(!ACCT.test(accountId||"")||typeof token!=="string"||token.length<20)
    throw Error("SHARK_ROUTE_SCOPED_TOKEN_REQUIRED");
  // This URL intentionally has no enabled=true filter; any attached SHARK
  // domain, including a disabled one, prevents certification.
  const domains=await apiGET(ROOT+"/accounts/"+accountId+"/workers/domains",token,fetcher);
  checkCustomDomains(domains);
  const zones=await apiGET(ROOT+"/zones?account.id="+accountId+"&per_page=50&page=1",token,fetcher);
  const ids=checkZones(zones,accountId);
  for(const id of ids) {
    const routes=await apiGET(ROOT+"/zones/"+id+"/workers/routes",token,fetcher);
    checkZoneRoutes(routes);
  }
  return {schema:"SHARK_CF_VISIBLE_INGRESS_01",
    status:"NO_SHARK_DOMAIN_OR_ROUTE_FOUND_IN_TOKEN_VISIBLE_INVENTORY",
    visibleZonesChecked:ids.length, matchingCustomDomains:0,
    matchingZoneRoutes:0, allAccountZonesAttested:false,
    externalApiPermissionsGloballyAttested:false,
    previewUrlsCheckedSeparately:false, remoteNoCronVerified:false,
    cronAuthorized:false, collectionAuthorized:false,canTrade:false,
    source:"REMOTE_SCOPED_READBACK_NO_CLOUDFLARE_WRITE"};
}
async function main() {
  const {values}=parseArgs({options:{mode:{type:"string"}},strict:true});
  if(values.mode!=="visible-ingress-readback") throw Error("INGRESS_MODE_NOT_APPROVED");
  const result=await readIngressInventory(
    process.env.SHARK_CF_ACCOUNT_ID,process.env.SHARK_CLOUDFLARE_API_TOKEN);
  process.stdout.write(JSON.stringify(result)+"\n");
}
if(process.argv[1]?.endsWith("/external_ingress_preflight.mjs"))
  main().catch(()=>{
    process.stderr.write("SHARK_CF_VISIBLE_INGRESS_FAIL_CLOSED\n");
    process.exitCode=1;
  });
