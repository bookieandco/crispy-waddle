import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { auditAssetRegistry, gitBlobSha } from './verify-original-assets.mjs';

test('original asset registry passes only when approved and public copies are unchanged', () => {
  const root = mkdtempSync(join(tmpdir(), 'pupson-asset-audit-'));
  try {
    const source = 'assets/approved/mug.glb';
    const runtime = 'public/models/mug.glb';
    const bytes = Buffer.from('fixture-not-a-real-GLB');
    for (const p of [source, runtime]) {
      mkdirSync(dirname(join(root, p)), { recursive: true });
      writeFileSync(join(root, p), bytes);
    }
    const manifest = { schema: 'pupson.original-assets.v1', assets: [
      { id: 'mug', source, runtime, gitBlobSha: gitBlobSha(bytes), sizeBytes: bytes.length }
    ] };
    assert.deepEqual(auditAssetRegistry(root, manifest), []);
    writeFileSync(join(root, runtime), Buffer.from('tampered!'));
    assert.match(auditAssetRegistry(root, manifest).join(' '), /drift/);
    assert.match(auditAssetRegistry(root, { ...manifest, assets: [
      { ...manifest.assets[0], source: '../outside.glb' }
    ] }).join(' '), /unsafe path/);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
