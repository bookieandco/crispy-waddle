import test from 'node:test';
import assert from 'node:assert/strict';
import {shadowHealthBindAddress} from './shark-shadow-service-binding.js';

test('fresh paper health and owner sync remain loopback by default',()=>{
  assert.equal(shadowHealthBindAddress({}),'127.0.0.1');
  assert.equal(shadowHealthBindAddress({SHARK_SHADOW_REMOTE_BIND_APPROVED:'YES'}),'127.0.0.1');
  assert.equal(shadowHealthBindAddress({SHARK_SHADOW_HEALTH_BIND_ADDRESS:'127.0.0.1'}),'127.0.0.1');
});
test('public network binding needs a separate explicit owner approval',()=>{
  assert.throws(()=>shadowHealthBindAddress({SHARK_SHADOW_HEALTH_BIND_ADDRESS:'0.0.0.0'}),
    /EXPLICIT_APPROVAL_REQUIRED/);
  assert.throws(()=>shadowHealthBindAddress({SHARK_SHADOW_HEALTH_BIND_ADDRESS:'0.0.0.0',SHARK_SHADOW_REMOTE_BIND_APPROVED:'true'}),
    /EXPLICIT_APPROVAL_REQUIRED/);
  assert.equal(shadowHealthBindAddress({SHARK_SHADOW_HEALTH_BIND_ADDRESS:'0.0.0.0',
    SHARK_SHADOW_REMOTE_BIND_APPROVED:'YES'}),'0.0.0.0');
});
test('unsupported network bindings fail closed rather than silently expose',()=>{
  for(const target of ['::','::1','192.0.2.8','localhost',''] as const){
    assert.throws(()=>shadowHealthBindAddress({SHARK_SHADOW_HEALTH_BIND_ADDRESS:target}),
      /EXPLICIT_APPROVAL_REQUIRED/);
  }
});
