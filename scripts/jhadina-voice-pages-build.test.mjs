import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

describe('JH-VOICE-HOST source gate', () => {
  it('builds only authentic, explicitly unapproved static audio without provider calls', () => {
    const output = resolve('.tmp/jhadina-voice-pages-test');
    try {
      const result = spawnSync(process.execPath, ['scripts/jhadina-voice-pages-build.mjs'], {
        env: { ...process.env, JHADINA_PAGES_BUILD_DIR: output },
        encoding: 'utf8', timeout: 30000,
      });
      assert.equal(result.status, 0, result.stderr);
      const receipt = JSON.parse(readFileSync(join(output, 'provenance.json'), 'utf8'));
      assert.equal(receipt.status, 'audition_only_unapproved');
      assert.equal(receipt.generationPerformed, false);
      assert.equal(receipt.productionVoiceApproved, false);
      assert.equal(receipt.sourceReference, 'jhadina-audition:1274');
      assert.equal(receipt.assets.length, 7);
      assert.equal(existsSync(join(output, 'jhadina-voice-audition/candidate-2.mp3')), true);
      assert.equal(existsSync(join(output, 'jhadina-voice-audition-v2/candidate-2.mp3')), false);
      assert.equal(existsSync(join(output, 'index.html')), true);
    } finally {
      rmSync(output, { recursive: true, force: true });
    }
  });
});
