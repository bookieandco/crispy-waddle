import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { assertMoneyFinishInventory, type MoneyFinishInventory } from './money-finish-inventory.js';

const fixture = JSON.parse(readFileSync(new URL('../../../docs/architecture/MONEY-COMPONENT-TRUTH-MATRIX.json', import.meta.url),'utf8')) as MoneyFinishInventory;
test('FINISH.01 canonical inventory distinguishes merged, pending and external state', () => {
  assert.doesNotThrow(() => assertMoneyFinishInventory(fixture));
  for (const c of fixture.capabilities.filter(x => x.status === 'MAIN')) {
    for (const p of c.paths ?? []) {
      assert.equal(existsSync(new URL('../../../'+p, import.meta.url)),true,p);
    }
  }
  assert.equal(fixture.dependencies.find(x => x.pr===1166)?.base,'feat/purse-finish-integrity-payday-20261008');
  assert.equal(fixture.capabilities.find(x=>x.id==='SHADOW_GRADE_REPAIR')?.status,'OPEN_PR');
  assert.equal(fixture.capabilities.find(x=>x.id==='ORIGINAL_SHADOW_VOLUME_RESTORED')?.status,'EXTERNAL_BLOCKED');
});
test('FINISH.01 refuses to treat pending PR or unproven store as merged code', () => {
  const mutated = structuredClone(fixture);
  const item = mutated.capabilities.find(x=>x.id==='SHADOW_GRADE_REPAIR')!;
  (item as {status:string}).status='MAIN';
  assert.throws(()=>assertMoneyFinishInventory(mutated),/MAIN_FILE_PROOF_REQUIRED/);
  const another={...fixture,capabilities:[...fixture.capabilities,{...fixture.capabilities[0]!}]};
  assert.throws(()=>assertMoneyFinishInventory(another),/DUPLICATE_CAPABILITY/);
});
test('FINISH.01 rejects a stacked funding PR without its parent', () => {
  const mutated = structuredClone(fixture);
  const d=mutated.dependencies.find(x=>x.pr===1166)!;
  (d as unknown as {dependsOn:number[]}).dependsOn=[9999];
  assert.throws(()=>assertMoneyFinishInventory(mutated),/PARENT_PR_UNRESOLVED/);
});
