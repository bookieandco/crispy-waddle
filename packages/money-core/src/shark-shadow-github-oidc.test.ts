import test from 'node:test'
import assert from 'node:assert/strict'
import {validateGithubShadowClaims} from './shark-shadow-github-oidc.js'

test('SHADOW sync accepts the intended repo and custom audience',()=>{
  assert.doesNotThrow(()=>validateGithubShadowClaims({
    iss:'https://token.actions.githubusercontent.com',
    aud:'jhadina-shadow-sync',
    exp:2_000_000_000,
    nbf:1_700_000_000,
    repository:'bookieandco/crispy-waddle',
    repository_id:'1320251374',
    workflow_ref:'bookieandco/crispy-waddle/.github/workflows/shark-shadow-swlc-recovery-sync.yml@refs/heads/main',
  },1_800_000_000))
})

test('SHADOW sync rejects another repository even with the right audience',()=>{
  assert.throws(()=>validateGithubShadowClaims({
    iss:'https://token.actions.githubusercontent.com',
    aud:'jhadina-shadow-sync',
    exp:2_000_000_000,
    repository:'other/repo',
    repository_id:'999',
  },1_800_000_000),/REPOSITORY_INVALID/)
})

test('SHADOW sync rejects wrong audiences and expired tokens',()=>{
  assert.throws(()=>validateGithubShadowClaims({
    iss:'https://token.actions.githubusercontent.com',aud:'wrong',exp:2_000_000_000,
    repository_id:'1320251374',
  },1_800_000_000),/AUDIENCE_INVALID/)
  assert.throws(()=>validateGithubShadowClaims({
    iss:'https://token.actions.githubusercontent.com',aud:'jhadina-shadow-sync',exp:1_700_000_000,
    repository_id:'1320251374',
  },1_800_000_000),/EXPIRED/)
})
