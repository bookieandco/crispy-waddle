import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {kalshiGoogleServiceAccountTokens} from './kalshi-15m-google-host-auth.js';

test('service-account scope must be explicitly configured on an absolute host path',()=>{
  assert.throws(()=>kalshiGoogleServiceAccountTokens({
    runtimeDir:'./node_modules',credentialsPath:'/private/google.json',
  }),/ABSOLUTE/);
  assert.throws(()=>kalshiGoogleServiceAccountTokens({
    runtimeDir:'/opt/test',credentialsPath:'./google.json',
  }),/ABSOLUTE/);
});

test('host-only mocked GoogleAuth is limited to Sheets and returns a fresh token',async()=>{
  const root=await mkdtemp(join(tmpdir(),'kalshi-google-host-'));
  try{
    const dir=join(root,'node_modules','google-auth-library');
    await mkdir(dir,{recursive:true});
    await writeFile(join(dir,'index.js'),`
      exports.GoogleAuth = class GoogleAuth {
        constructor(options) {
          if(options.scopes.length !== 1 ||
             options.scopes[0] !== 'https://www.googleapis.com/auth/spreadsheets')
            throw new Error('GOOGLE_SCOPE_EXCESSIVE');
          if(!options.keyFile.endsWith('/private.json'))
            throw new Error('GOOGLE_KEYFILE_NOT_LOCAL');
        }
        async getClient() { return {getAccessToken: async()=>({token:'synthetic-test-token'})}; }
      };
    `);
    const p=kalshiGoogleServiceAccountTokens({
      runtimeDir:root,credentialsPath:join(root,'private.json'),
    });
    assert.equal(await p.accessToken(),'synthetic-test-token');
  }finally{await rm(root,{recursive:true,force:true});}
});
