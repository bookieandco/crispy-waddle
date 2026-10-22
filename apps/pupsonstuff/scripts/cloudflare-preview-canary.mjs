#!/usr/bin/env node
/** Read-only: GET storefront, health, blocked API and public immutable 3D assets. */
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
export class PreviewNotPropagatedError extends Error {
  constructor(message) { super(message); this.name = 'PreviewNotPropagatedError'; }
}
// Only HTTP statuses typical of edge propagation may retry. A 200 health
// route, unexpected app identity, unsafe checkout or invalid URL fail instantly.
const isTemporaryStatus = (status) => [404, 429, 502, 504, 520, 521, 522, 523, 524].includes(status);

const get = (fetchImpl,uri,accept) => fetchImpl(uri, {
  method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
  headers:{Accept:accept},signal:AbortSignal.timeout(12_000)
});
export async function checkWorkerPreview({url,sha='',fetchImpl=fetch}) {
  const origin=parseWorkerPreviewUrl(url);
  if(sha&&!/^[a-f0-9]{40}$/.test(sha))throw Error('Full source SHA required.');
  const health=await get(fetchImpl,origin+'/api/health','application/json');
  if(health.status!==503)throw (isTemporaryStatus(health.status) ?
    new PreviewNotPropagatedError(`Health endpoint not propagated (HTTP ${health.status})`) :
    new Error(`Credential-free preview must report fail-closed 503 health (observed HTTP ${health.status}).`));
  if(!String(health.headers?.get('content-type')).includes('application/json'))throw Error('Health content-type mismatch.');
  const data=JSON.parse((await health.text()).slice(0,8192));
  if(data.service!=='pupsonstuff'||data.status!=='degraded'||
      data.database!=='not_configured'||data.environment!=='preview'||
      data.fulfillmentMode!=='dry_run')throw Error('Dedicated view-only health identity mismatch.');
  if(sha && data.commit!==sha.slice(0,12))throw new PreviewNotPropagatedError('Edge is still serving a prior source SHA.');
  const page=await get(fetchImpl,origin+'/','text/html');
  if(page.status!==200||!String(page.headers?.get('content-type')).includes('text/html'))
    throw (isTemporaryStatus(page.status) ?
      new PreviewNotPropagatedError(`Storefront endpoint not propagated (HTTP ${page.status})`) :
      new Error('Storefront HTML unavailable.'));
  const blocked=await get(fetchImpl,origin+'/api/checkout','application/json');
  if(blocked.status!==503)throw Error('Preview API safety middleware is not enforced.');
  const blockedBody=JSON.parse((await blocked.text()).slice(0,8192));
  if(blockedBody.error!=='PupsonStuff preview is read-only.')throw Error('Expected view-only boundary response.');
  // The GLBs can exist in Git yet be missing from the deployed Worker asset
  // bundle. Validate actual binary magic, not merely an HTML 200 fallback.
  const glbPaths = [
    '/models/shirt_baked.glb', '/models/hoodie.glb', '/models/mug.glb',
    '/models/pillow.glb', '/models/bottle.glb', '/models/tote.glb',
  ];
  for (const asset of glbPaths) {
    const res = await get(fetchImpl, origin + asset, 'model/gltf-binary,application/octet-stream');
    if (res.status !== 200) {
      throw (isTemporaryStatus(res.status)
        ? new PreviewNotPropagatedError(`Product 3D asset not propagated: ${asset} (HTTP ${res.status})`)
        : new Error(`Product 3D asset unavailable: ${asset} (HTTP ${res.status})`));
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const declared = bytes.length >= 12
      ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8, true)
      : 0;
    if (bytes.length < 20 || bytes[0] !== 103 || bytes[1] !== 108 ||
        bytes[2] !== 84 || bytes[3] !== 70 || // ASCII "glTF"
        bytes[4] !== 2 || bytes[5] !== 0 || bytes[6] !== 0 || bytes[7] !== 0 ||
        declared !== bytes.length) {
      throw new Error(`Product 3D asset invalid or HTML fallback: ${asset}`);
    }
  }
  return {schema:'pupson.cf-preview.v1',origin,commit:data.commit,
    storefront:'pass',health:'fail_closed',api:'blocked',models:'pass',
    certifies:'static view-only preview with real GLBs only; no DB access, creative jobs, payments, or fulfillment'};
}
/**
 * Guarded, bounded GET-only retry for the first minute of Worker edge
 * propagation. Must never mask safety assertions (checkout unblocked, wrong
 * project, 200 health, malicious redirects) or accept the wrong source SHA.
 */
export async function waitForWorkerPreview({
  attempts = 8,
  delayMs = 8000,
  wait = (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  onRetry = () => {},
  ...input
} = {}) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 12 ||
      !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 30000) {
    throw Error('Invalid bounded canary retry parameters.');
  }
  for (let index = 0; index < attempts; index++) {
    try {
      return await checkWorkerPreview(input);
    } catch (error) {
      const network = error instanceof TypeError ||
        error?.name === 'TimeoutError' || error?.name === 'AbortError';
      if (!(error instanceof PreviewNotPropagatedError) && !network) throw error;
      if (index === attempts - 1) throw error;
      onRetry({ attempt: index + 1, total: attempts, reason: String(error.message).slice(0, 140) });
      await wait(delayMs);
    }
  }
  throw Error('Unreachable preview retry state.');
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const url=process.env.PUPSON_CF_PREVIEW_URL;
  waitForWorkerPreview({
    url, sha:process.env.GITHUB_SHA||'',
    onRetry: ({attempt,total,reason}) => console.log(`Preview edge warming (${attempt}/${total}): ${reason}`),
  })
    .then(res=>console.log(JSON.stringify(res,null,2)))
    .catch(e=>{console.error(e.message);process.exitCode=1;});
}
