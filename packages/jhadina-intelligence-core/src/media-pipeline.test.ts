import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GovernedMediaPipeline } from './media-pipeline.js';

const asset:any = {
  id:'asset_1',
  actorId:'u',
  modality:'video',
  mediaType:'video/mp4',
  assetRef:'s',
  privacyClass:'internal',
  createdAt:'2026-01-01T00:00:00Z',
  status:'registered',
};

const perception = {
  async extract(i:any) {
    return {
      assetId:i.asset.id,
      evidence:[{
        id:'asset:asset_1:frame:0',
        source:'p',
        observedAt:i.asset.createdAt,
        summary:'frame',
        immutable:true,
      }],
      uncertainty:[],
    };
  },
};

const intake = {
  async route(a:any) {
    return {
      assetId:a.id,
      routes:[{
        subsystem:'sports-intelligence' as const,
        reason:'intent',
        confidence:.9,
      }],
      requiresHumanSelection:false,
    };
  },
};

test('composes extraction then subsystem routing', async () => {
  const calls:string[] = [];
  const p = new GovernedMediaPipeline(
    { async extract(i:any) { calls.push('extract'); return perception.extract(i); } },
    { async route(a:any) { calls.push('route'); return intake.route(a); } },
  );
  const o = await p.process({asset,intent:'boxing'});
  assert.deepEqual(calls,['extract','route']);
  assert.equal(o.evidence[0].id,'asset:asset_1:frame:0');
  assert.equal(o.routing.routes[0].subsystem,'sports-intelligence');
});

test('pipeline exposes evidence/routing, not execution', () => {
  const p:any = new GovernedMediaPipeline(perception, intake);
  assert.equal(p.execute,undefined);
  assert.equal(p.approve,undefined);
});
