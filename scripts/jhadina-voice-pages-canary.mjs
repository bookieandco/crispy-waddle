#!/usr/bin/env node
/**
 * JH-VOICE-HOST.04–.05: verify an actual deployed Pages preview against the
 * exact local allowlisted bundle, without generating audio or using secrets.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const EXPECTED_PROJECT = 'jhadina-voice-audition.pages.dev';
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

export function validatePreviewOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/' ||
      !url.hostname.endsWith('.' + EXPECTED_PROJECT) ||
      url.hostname.split('.').length !== 4) {
    throw new Error('JHADINA_VOICE_WRONG_PREVIEW_ORIGIN');
  }
  return url.origin;
}

export function extractPreviewOrigin(log) {
  // Wrangler emits BOTH an immutable build URL and a mutable branch alias.
  // Certify the exact build URL, not the 'voice-preview' branch alias, and
  // fail closed when no unique immutable deployment receipt exists.
  const candidates = [...log.matchAll(/https:\/\/([a-f0-9]{7,32})\.jhadina-voice-audition\.pages\.dev\/?/gi)];
  const origins = [...new Set(candidates.map(match => {
    try { return validatePreviewOrigin(match[0].replace(/\/$/, '') + '/'); }
    catch { return null; }
  }).filter(Boolean))];
  if (origins.length !== 1) throw new Error('JHADINA_VOICE_PREVIEW_URL_UNVERIFIED');
  return origins[0];
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

export function validateProvenance(receipt, local, expectedSha) {
  assert(/^[a-f0-9]{40}$/.test(expectedSha), 'JHADINA_VOICE_SHA_INVALID');
  assert(receipt.revision === expectedSha && local.revision === expectedSha, 'JHADINA_VOICE_DEPLOY_SHA_MISMATCH');
  assert(receipt.status === 'audition_only_unapproved' &&
         receipt.productionVoiceApproved === false &&
         receipt.generationPerformed === false, 'JHADINA_VOICE_APPROVAL_BYPASS');
  assert(receipt.sourceReference === 'jhadina-audition:1274', 'JHADINA_VOICE_REFERENCE_CHANGED');
  assert(Array.isArray(receipt.assets) && receipt.assets.length === local.assets.length,
         'JHADINA_VOICE_ASSET_COUNT_MISMATCH');
  assert(JSON.stringify(receipt.assets) === JSON.stringify(local.assets), 'JHADINA_VOICE_ASSET_DIGEST_MISMATCH');
  for (const item of receipt.assets) {
    assert(/^[\w/-]+\.(html|mp3)$/.test(item.file) && !item.file.includes('..') &&
           /^[a-f0-9]{64}$/.test(item.sha256) &&
           Number.isSafeInteger(item.bytes) && item.bytes > 0 &&
           item.bytes <= 25 * 1024 * 1024, 'JHADINA_VOICE_INVALID_ASSET');
  }
}

async function getBytes(base, path) {
  const response = await fetch(base + '/' + path, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(12000),
    headers: { 'Cache-Control': 'no-cache' },
  });
  assert(response.ok && response.status === 200, 'JHADINA_VOICE_FETCH_FAILED:' + path);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert(bytes.length <= 25 * 1024 * 1024, 'JHADINA_VOICE_REMOTE_ASSET_OVERSIZE');
  return { bytes, type: response.headers.get('content-type') ?? '' };
}

export async function verifyPreview({
  origin, expectedSha, localReceiptPath = '.tmp/jhadina-voice-pages/provenance.json',
}) {
  const base = validatePreviewOrigin(origin);
  const local = JSON.parse(readFileSync(localReceiptPath, 'utf8'));
  const remote = await getBytes(base, 'provenance.json');
  assert(remote.bytes.length < 20000, 'JHADINA_VOICE_RECEIPT_OVERSIZE');
  const receipt = JSON.parse(remote.bytes.toString('utf8'));
  validateProvenance(receipt, local, expectedSha);

  for (const asset of receipt.assets) {
    const response = await getBytes(base, asset.file);
    assert(response.bytes.length === asset.bytes &&
           sha256(response.bytes) === asset.sha256,
           'JHADINA_VOICE_AUDIO_OR_PAGE_HASH_MISMATCH:' + asset.file);
    if (asset.file.endsWith('.mp3')) {
      assert(response.type.includes('audio/mpeg'), 'JHADINA_VOICE_AUDIO_MIME_INVALID:' + asset.file);
      assert(response.bytes.subarray(0, 3).toString() === 'ID3' ||
        (response.bytes[0] === 0xff && (response.bytes[1] & 0xe0) === 0xe0),
        'JHADINA_VOICE_MP3_CONTENT_INVALID:' + asset.file);
    }
  }

  if (!receipt.assets.some(asset => asset.file.startsWith('jhadina-voice-audition-v2/') && asset.file.endsWith('.mp3'))) {
    const absent = await fetch(base + '/jhadina-voice-audition-v2/candidate-1.mp3', {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(12000),
    });
    assert(absent.status === 404, 'JHADINA_VOICE_UNRENDERED_TAKE_EXPOSED');
  }
  return {
    status: 'verified_public_preview_only',
    previewOrigin: base,
    revision: expectedSha,
    candidateTwoMatched: true,
    remoteAssets: receipt.assets.length,
    liveSpeakerApproved: false,
  };
}

if (process.argv[1]?.endsWith('jhadina-voice-pages-canary.mjs')) {
  const origin = process.env.JHADINA_VOICE_PAGES_URL;
  const expectedSha = process.env.GITHUB_SHA;
  if (!origin || !expectedSha) throw new Error('JHADINA_VOICE_REMOTE_CANARY_INPUT_REQUIRED');
  verifyPreview({ origin, expectedSha })
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(String(error)); process.exitCode = 1; });
}
