import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkerPreviewUrl, extractDeployOrigin,checkWorkerPreview,waitForWorkerPreview } from './cloudflare-preview-canary.mjs';
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


test('eventual 503 edge publication passes after initial 404 (GET only)',async()=>{
  let calls=0;
  const {handler,requests}=fetchStub();
  const fetchImpl=(path,init)=>{
    if(path.endsWith('/api/health') && ++calls===1)
      return Promise.resolve({status:404,headers:{get:()=> 'text/plain'},text:async()=> 'not found'});
    return handler(path,init);
  };
  const waits=[];
  const result=await waitForWorkerPreview({
    url,sha,fetchImpl,attempts:3,delayMs:5,
    wait:async ms=>waits.push(ms),
  });
  assert.equal(result.commit,sha.slice(0,12));
  assert.deepEqual(waits,[5]);
  assert.ok(requests.every(x=>x.init.method==='GET'));
});

test('stale but fully fail-closed worker is retried until exact SHA arrives',async()=>{
  const {handler}=fetchStub();
  let healthCalls=0;
  const fetchImpl=async(path,init)=>{
    const res=await handler(path,init);
    if(path.endsWith('/api/health') && ++healthCalls===1) {
      return {...res, text:async()=>JSON.stringify({service:'pupsonstuff',status:'degraded',
        database:'not_configured',environment:'preview',fulfillmentMode:'dry_run',
        commit:'stale-version'})};
    }
    return res;
  };
  const result=await waitForWorkerPreview({url,sha,fetchImpl,attempts:3,delayMs:0,wait:async()=>{}});
  assert.equal(result.commit,sha.slice(0,12));
  assert.equal(healthCalls,2);
});

test('unsafe checkout response fails immediately, never retries',async()=>{
  const {handler}=fetchStub();
  let count=0;
  const fetchImpl=(path,init)=>{
    count++;
    if(path.endsWith('/api/checkout'))
      return Promise.resolve({status:200,headers:{get:()=> 'application/json'},text:async()=> '{}'});
    return handler(path,init);
  };
  const waits=[];
  await assert.rejects(waitForWorkerPreview({
    url,sha,fetchImpl,attempts:5,delayMs:0,wait:async()=>waits.push(true),
  }),/middleware is not enforced/);
  assert.deepEqual(waits,[]);
  assert.equal(count,3);
});

test('wrong health status 200 cannot be retried into success',async()=>{
  const {handler}=fetchStub();
  const fetchImpl=(path,init)=>path.endsWith('/api/health')
    ? Promise.resolve({status:200,headers:{get:()=> 'application/json'},text:async()=> '{}'})
    : handler(path,init);
  await assert.rejects(waitForWorkerPreview({url,sha,fetchImpl,attempts:5,wait:async()=>{}}),
    /observed HTTP 200/);
});

test('propagation must fail after bounded attempts',async()=>{
  const attempts=[];
  await assert.rejects(waitForWorkerPreview({
    url,sha,fetchImpl:async()=>({status:404}),
    attempts:3,delayMs:2,wait:async ms=>attempts.push(ms),
  }),/not propagated/);
  assert.deepEqual(attempts,[2,2]);
});
