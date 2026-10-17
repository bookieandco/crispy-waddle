import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePreviewOrigin, extractPreviewOrigin, validateProvenance,
} from './jhadina-voice-pages-canary.mjs';

const sha = 'a'.repeat(40);
const asset = {
  file: 'jhadina-voice-audition/candidate-2.mp3',
  sha256: 'b'.repeat(64),
  bytes: 18400,
};
const receipt = () => ({
  revision: sha,
  status: 'audition_only_unapproved',
  productionVoiceApproved: false,
  generationPerformed: false,
  sourceReference: 'jhadina-audition:1274',
  assets: [{ ...asset }],
});

describe('Cloudflare Pages deployment receipt and preview origin', () => {
  it('accepts only a dedicated HTTPS preview, never production or arbitrary hosts', () => {
    const accepted = 'https://voice-preview.jhadina-voice-audition.pages.dev';
    assert.equal(validatePreviewOrigin(accepted + '/'), accepted);
    for (const url of [
      'https://jhadina-voice-audition.pages.dev',
      'http://voice-preview.jhadina-voice-audition.pages.dev/',
      'https://voice-preview.jhadina-voice-audition.pages.dev.evil.test/',
      'https://other.pages.dev/',
      'https://user:pw@voice-preview.jhadina-voice-audition.pages.dev/',
      'https://voice-preview.jhadina-voice-audition.pages.dev/evil',
      'https://voice-preview.jhadina-voice-audition.pages.dev/?token=1',
    ]) assert.throws(() => validatePreviewOrigin(url), /WRONG_PREVIEW_ORIGIN/);
  });

  it('extracts actual preview from Wrangler output without inventing a Pages URL', () => {
    assert.equal(
      extractPreviewOrigin('✨ Deployment complete: https://e9d23aa.jhadina-voice-audition.pages.dev'),
      'https://e9d23aa.jhadina-voice-audition.pages.dev',
    );
    assert.equal(
      extractPreviewOrigin(
        '✨ Deployment complete! Take a peek over at https://625dc5fd.jhadina-voice-audition.pages.dev\n' +
        '✨ Deployment alias URL: https://voice-preview.jhadina-voice-audition.pages.dev'
      ),
      'https://625dc5fd.jhadina-voice-audition.pages.dev',
      'must select immutable build URL when Wrangler emits branch alias too',
    );
    assert.throws(() => extractPreviewOrigin(
      '✨ Deployment alias URL: https://voice-preview.jhadina-voice-audition.pages.dev'
    ), /URL_UNVERIFIED/, 'mutable alias by itself is not deployment proof');
    assert.throws(() => extractPreviewOrigin(
      'Deployment complete: https://625dc5fd.jhadina-voice-audition.pages.dev\n' +
      'Deployment complete: https://e9d23aa8.jhadina-voice-audition.pages.dev'
    ), /URL_UNVERIFIED/, 'multiple immutable releases are ambiguous');
    assert.throws(() => extractPreviewOrigin('Successful build; no URL'), /URL_UNVERIFIED/);
    assert.throws(() => extractPreviewOrigin(
      'https://first.jhadina-voice-audition.pages.dev and https://other.jhadina-voice-audition.pages.dev'
    ), /URL_UNVERIFIED/);
  });

  it('rejects forged SHA, approval changes, invented files and arbitrary metadata', () => {
    const valid = receipt();
    assert.doesNotThrow(() => validateProvenance(valid, receipt(), sha));
    for (const mutate of [
      r => { r.revision = 'c'.repeat(40); },
      r => { r.productionVoiceApproved = true; },
      r => { r.generationPerformed = true; },
      r => { r.assets[0].sha256 = 'not-a-hash'; },
      r => { r.assets[0].file = '../../secrets.mp3'; },
      r => { r.sourceReference = 'some-other-speaker'; },
    ]) {
      const bogus = receipt();
      mutate(bogus);
      assert.throws(() => validateProvenance(bogus, receipt(), sha));
    }
  });
});
