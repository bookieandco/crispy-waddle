import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkerPreviewUrl, extractDeployOrigin,checkWorkerPreview } from './cloudflare-preview-canary.mjs';
const url='https://pupsonstuff-preview-free.owner-subdomain.workers.dev/';
const sha='0123456789abcdef0123456789abcdef01234567';
function fetchStub() {
  const requests=[];
  const handler=async (path, init)=>{
    requests.push({path,init});
    const resp=(status,type,body)=>({status,headers:{get:()=>type},text:async()=>JSON.stringify(body)});
    if(path.endsWith('/api/health'))return resp(503,'application/json',{service:'pupsonstuff',
      status:'degraded',database:'not_configured',environment:'preview',
      fulfillmentMode:'dry_run',commit:sha.slice(0,12)});
    if(path.endsWith('/api/checkout'))return resp(503,'application/json',{success:false,error:'PupsonStuff preview is read-only.'});
    if(path.endsWith('/'))return resp(200,'text/html',{});
    throw Error('Forbidden test URL');
  };
  return {handler,requests};
}
test('accept dedicated Cloudflare workers.dev origin only',()=>{
  assert.equal(parseWorkerPreviewUrl(url),url.slice(0,-1));
  for(const bad of ['http://pupsonstuff-preview-free.owner.workers.dev/',
    'https://evil.workers.dev/','https://pupsonstuff-preview-free.owner.workers.dev/checkout',
    'https://pupsonstuff-preview-free.owner.workers.dev/?token=x',
    'https://pupsonstuff-preview-free.owner.workers.dev.evil.test/'])
    assert.throws(()=>parseWorkerPreviewUrl(bad));
});
test('parse wrangler receipt uniquely',()=>{
  assert.equal(extractDeployOrigin('Deployed https://pupsonstuff-preview-free.owner-subdomain.workers.dev'),
    url.slice(0,-1));
});
test('only read-only URLs and safe HTTP methods used',async()=>{
  const {handler,requests}=fetchStub();
  const x=await checkWorkerPreview({url,sha,fetchImpl:handler});
  assert.equal(x.api,'blocked');
  assert.deepEqual(requests.map(x=>new URL(x.path).pathname),['/api/health','/','/api/checkout']);
  assert.ok(requests.every(x=>x.init.method==='GET'&&x.init.redirect==='error'));
});
test('stale deployed SHA fails canary',async()=>{
  const {handler}=fetchStub();
  await assert.rejects(checkWorkerPreview({url,sha:'f'.repeat(40),fetchImpl:handler}),/SHA/);
});
