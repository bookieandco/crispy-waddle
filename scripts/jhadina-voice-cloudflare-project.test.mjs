import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ensureVoicePagesProject } from './jhadina-voice-cloudflare-project.mjs';
const accountId = 'a'.repeat(32);
const token = 'test-not-real';
const base = 'jhadina-voice-audition';
const json = (status, value) => ({
  status, json: async () => value,
});
const success = {success:true,result:{name:base,domains:[base+'.pages.dev']}};
describe('JH-VOICE-COMMISSION.02 Pages bootstrap (manual only)', () => {
  it('uses existing isolated direct-upload project without mutating it', async () => {
    const calls=[];
    const result = await ensureVoicePagesProject({ accountId,token,request:async(url,opts)=>{
      calls.push({url,method:opts.method,headers:opts.headers});
      return json(200, success);
    }});
    assert.equal(result.status,'existing');
    assert.deepEqual(calls.map(c=>c.method),['GET']);
    assert.equal(calls[0].url, 'https://api.cloudflare.com/client/v4/accounts/'+accountId+'/pages/projects/'+base);
  });
  it('creates only dedicated Pages project after explicit 404', async () => {
    const methods=[];let payload;
    const result=await ensureVoicePagesProject({accountId,token,request:async(url,opts)=>{
      methods.push(opts.method);
      if(opts.method==='GET')return json(404,{});
      payload=JSON.parse(opts.body);
      return json(200,success);
    }});
    assert.equal(result.status,'created');
    assert.deepEqual(payload,{name:base,production_branch:'main'});
    assert.deepEqual(methods,['GET','POST']);
  });
  it('refuses API/auth failures and existing project collisions, no accidental POST', async () => {
    const request = async() => json(403,{});
    await assert.rejects(
      ensureVoicePagesProject({accountId,token,request}),
      /PROBE_UNEXPECTED_STATUS/,
    );
    const collision=async()=>json(200,{success:true,result:{name:base,source:{type:'github'},domains:[base+'.pages.dev']}});
    await assert.rejects(ensureVoicePagesProject({accountId,token,request:collision}),/SCOPE_MISMATCH/);
    const withDomain=async()=>json(200,{success:true,result:{name:base,domains:[base+'.pages.dev','yourdomain.com']}});
    await assert.rejects(ensureVoicePagesProject({accountId,token,request:withDomain}),/SCOPE_MISMATCH/);
    await assert.rejects(ensureVoicePagesProject({accountId,token:'',request}),/CREDENTIAL_SCOPE_REQUIRED/);
  });
});
