#!/usr/bin/env node
/** Read-only: GET storefront + GET health + GET intentionally blocked API. */
import { fileURLToPath } from 'node:url';

export function parseWorkerPreviewUrl(value) {
  if(typeof value!=='string'||value.length>500)throw Error('Worker URL required.');
  let url;try{url=new URL(value);}catch{throw Error('Invalid URL.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash||
      !/^pupsonstuff-preview-free\.[a-z0-9-]+\.workers\.dev$/i.test(url.hostname))
    throw Error('Only dedicated PupsonStuff workers.dev preview origin is accepted.');
  return url.origin;
}
export function extractDeployOrigin(log) {
  const urls = String(log).match(/https:\/\/[a-z0-9.-]+\.workers\.dev\/?/gi)||[];
  const valid=urls.map(s=>{try{return parseWorkerPreviewUrl(s);}catch{return null;}}).filter(Boolean);
  if(valid.length!==1 && !(valid.length>1&&new Set(valid).size===1))throw Error('Could not identify a unique preview workers.dev URL in deploy receipt.');
  return valid[0];
}
const get = (fetchImpl,uri,accept) => fetchImpl(uri, {
  method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
  headers:{Accept:accept},signal:AbortSignal.timeout(12_000)
});
export async function checkWorkerPreview({url,sha='',fetchImpl=fetch}) {
  const origin=parseWorkerPreviewUrl(url);
  if(sha&&!/^[a-f0-9]{40}$/.test(sha))throw Error('Full source SHA required.');
  const health=await get(fetchImpl,origin+'/api/health','application/json');
  if(health.status!==503)throw Error('Credential-free preview must report a fail-closed 503 health status.');
  if(!String(health.headers?.get('content-type')).includes('application/json'))throw Error('Health content-type mismatch.');
  const data=JSON.parse((await health.text()).slice(0,8192));
  if(data.service!=='pupsonstuff'||data.status!=='degraded'||
      data.database!=='not_configured'||data.environment!=='preview'||
      data.fulfillmentMode!=='dry_run')throw Error('Dedicated view-only health identity mismatch.');
  if(sha && data.commit!==sha.slice(0,12))throw Error('Source SHA did not match deployed Worker.');
  const page=await get(fetchImpl,origin+'/','text/html');
  if(page.status!==200||!String(page.headers?.get('content-type')).includes('text/html'))
    throw Error('Storefront HTML unavailable.');
  const blocked=await get(fetchImpl,origin+'/api/checkout','application/json');
  if(blocked.status!==503)throw Error('Preview API safety middleware is not enforced.');
  const blockedBody=JSON.parse((await blocked.text()).slice(0,8192));
  if(blockedBody.error!=='PupsonStuff preview is read-only.')throw Error('Expected view-only boundary response.');
  return {schema:'pupson.cf-preview.v1',origin,commit:data.commit,
    storefront:'pass',health:'fail_closed',api:'blocked',
    certifies:'static view-only preview only; no DB access, creative jobs, payments, or fulfillment'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const url=process.env.PUPSON_CF_PREVIEW_URL;
  checkWorkerPreview({url,sha:process.env.GITHUB_SHA||''})
    .then(res=>console.log(JSON.stringify(res,null,2)))
    .catch(e=>{console.error(e.message);process.exitCode=1;});
}
