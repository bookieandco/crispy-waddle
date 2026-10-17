#!/usr/bin/env node
/**
 * JH-VOICE-HOST.01 – isolated, zero-inference Cloudflare Pages static bundle.
 * Only allowlisted public audition MP3s/pages. Neither a GPU nor a voice
 * provider is contacted. Missing future takes must not look playable.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(process.cwd());
const source = join(root, 'apps/jhadina-web/public');
const dest = resolve(root, process.env.JHADINA_PAGES_BUILD_DIR ?? '.tmp/jhadina-voice-pages');
const maxBytes = 25 * 1024 * 1024;
function assert(condition, message) { if (!condition) throw new Error(message); }
function copy(relativeSource, relativeDest) {
  const input = join(source, relativeSource);
  assert(existsSync(input), 'VOICE_HOST_REQUIRED_FILE_MISSING:' + relativeSource);
  const data = readFileSync(input);
  assert(data.length > 0 && data.length <= maxBytes, 'VOICE_HOST_ASSET_SIZE_INVALID:' + relativeSource);
  const output = join(dest, relativeDest);
  mkdirSync(dirname(output), { recursive: true });
  copyFileSync(input, output);
  return { file: relativeDest, sha256: createHash('sha256').update(data).digest('hex'), bytes: data.length };
}
function mp3HasHeader(filename) {
  const data = readFileSync(filename);
  return data.length >= 4 && (
    data.subarray(0, 3).toString() === 'ID3' ||
    (data[0] === 0xff && (data[1] & 0xe0) === 0xe0)
  );
}
function assertCandidateGroup(manifest, dir) {
  assert(manifest.state === 'candidate_unapproved' && manifest.qualityClaim === false, 'VOICE_HOST_APPROVAL_FLAG_INVALID');
  assert(Array.isArray(manifest.candidates) && manifest.candidates.length === 4, 'VOICE_HOST_EXPECTED_FOUR_TAKES');
  const unique = new Set();
  for (let i = 1; i <= 4; i++) {
    const c = manifest.candidates[i - 1];
    assert(c.state === 'candidate_unapproved' && c.qualityClaim === false, 'VOICE_HOST_CANDIDATE_APPROVAL_INVALID');
    assert(c.file === 'candidate-' + i + '.wav' && !unique.has(c.id), 'VOICE_HOST_CANDIDATE_SEQUENCE_INVALID');
    unique.add(c.id);
    assert(mp3HasHeader(join(dir, 'candidate-' + i + '.mp3')), 'VOICE_HOST_NOT_MP3:' + i);
  }
}
assert(dest.startsWith(root + '/') && dest !== root && !source.startsWith(dest + '/'), 'VOICE_HOST_UNSAFE_OUTPUT');
const original = JSON.parse(readFileSync(join(source, 'jhadina-voice-audition/manifest.json'), 'utf8'));
assertCandidateGroup(original, join(source, 'jhadina-voice-audition'));
assert(original.candidates[1].id === 'jhadina-audition:1274', 'VOICE_HOST_CANDIDATE_TWO_PROVENANCE_DRIFT');
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
const copied = [
  copy('jhadina-voice-audition-v2.html', 'index.html'),
  copy('jhadina-voice-audition-v2.html', 'jhadina-voice-audition-v2.html'),
  copy('jhadina-voice-audition.html', 'jhadina-voice-audition.html'),
];
for (let i = 1; i <= 4; i++) {
  copied.push(copy('jhadina-voice-audition/candidate-' + i + '.mp3',
                   'jhadina-voice-audition/candidate-' + i + '.mp3'));
}
// Future v2 MP3s are *never* uploaded just because a filename exists. A
// complete unapproved manifest with independently matching MP3 digests is
// required first. This bundle currently contains only original audio.
const v2dir = join(source, 'jhadina-voice-audition-v2');
const v2manifestPath = join(v2dir, 'manifest.json');
if (existsSync(v2manifestPath)) {
  const manifest = JSON.parse(readFileSync(v2manifestPath, 'utf8'));
  assert(manifest.state === 'candidate_unapproved' && manifest.qualityClaim === false,
         'VOICE_HOST_V2_APPROVAL_FLAG_INVALID');
  assert(manifest.packId === 'jhadina-candidate2-revision-v2-20261017', 'VOICE_HOST_V2_PACK_INVALID');
  assert(Array.isArray(manifest.candidates) && manifest.candidates.length === 4,
         'VOICE_HOST_V2_COUNT_INVALID');
  for (let i = 1; i <= 4; i++) {
    const name = 'candidate-' + i + '.mp3';
    const row = manifest.candidates[i - 1];
    const local = join(v2dir, name);
    assert(row.file === name && row.state === 'candidate_unapproved' && row.qualityClaim === false,
           'VOICE_HOST_V2_CANDIDATE_INVALID');
    assert(existsSync(local) && mp3HasHeader(local), 'VOICE_HOST_V2_FILE_MISSING:' + name);
    const digest = createHash('sha256').update(readFileSync(local)).digest('hex');
    assert(digest === row.mp3Sha256, 'VOICE_HOST_V2_HASH_MISMATCH:' + name);
  }
  for (let i = 1; i <= 4; i++) {
    copied.push(copy('jhadina-voice-audition-v2/candidate-' + i + '.mp3',
                     'jhadina-voice-audition-v2/candidate-' + i + '.mp3'));
  }
}
// Explicit 404 page disables Cloudflare Pages' single-page-app fallback.
const notFound = Buffer.from('<!doctype html><html lang="en"><meta charset="utf-8"><title>Audition not rendered</title><main><h1>404 · No verified audio here</h1><p>This voice candidate has not been rendered or published.</p></main></html>\n', 'utf8');
writeFileSync(join(dest, '404.html'), notFound);
copied.push({ file: '404.html', sha256: createHash('sha256').update(notFound).digest('hex'), bytes: notFound.length });
writeFileSync(join(dest, '_headers'),
  '/jhadina-voice-audition/*.mp3\n  Content-Type: audio/mpeg\n  Cache-Control: public, max-age=3600\n' +
  '/jhadina-voice-audition-v2/*.mp3\n  Content-Type: audio/mpeg\n  Cache-Control: public, max-age=3600\n' +
  '/*.html\n  Cache-Control: public, max-age=300\n');
writeFileSync(join(dest, 'provenance.json'), JSON.stringify({
  source: 'bookieandco/crispy-waddle',
  revision: process.env.GITHUB_SHA ?? 'local-unverified',
  status: 'audition_only_unapproved',
  productionVoiceApproved: false,
  generationPerformed: false,
  sourceReference: original.candidates[1].id,
  assets: copied,
}, null, 2) + '\n');
console.log(JSON.stringify({
  status: 'VOICE_HOST_STATIC_BUNDLE_READY',
  destination: dest, files: copied.length,
  v2AudioRendered: existsSync(v2manifestPath),
  productionVoiceApproved: false,
}, null, 2));
