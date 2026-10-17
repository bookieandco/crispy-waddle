#!/usr/bin/env node
/**
 * JH-VOICE-HOST.07 — offline, unapproved Qwen audition packaging.
 * Requires four genuine hash-bound WAVs from the manually authorized
 * candidate2-v2 RunPod generation workflow. No provider or cloud calls.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const sha256 = data => createHash('sha256').update(data).digest('hex');
const requireTrue = (test, code) => { if (!test) throw new Error(code); };
const sha64 = /^[a-f0-9]{64}$/;
const maxBytes = 25 * 1024 * 1024;
const model = 'Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign';
function validWav(data) {
  return data.length > 44 && data.subarray(0, 4).toString('ascii') === 'RIFF'
    && data.subarray(8, 12).toString('ascii') === 'WAVE';
}
function validMp3(data) {
  return data.length > 4096 &&
    (data.subarray(0, 3).toString('ascii') === 'ID3' ||
     (data[0] === 0xff && (data[1] & 0xe0) === 0xe0));
}

export function validateRenderedVoicePack(pack, manifest, folder) {
  requireTrue(pack.auditionOnly === true && pack.productionApproved === false && pack.qualityClaim === false,
    'JH_V2_SPEC_APPROVAL_INVALID');
  requireTrue(manifest.identity === 'voice:jhadina:canonical:v1' &&
    manifest.profile === 'jhadina:canonical' &&
    manifest.state === 'candidate_unapproved' && manifest.qualityClaim === false &&
    manifest.packId === pack.packId && pack.packId === 'jhadina-candidate2-revision-v2-20261017' &&
    Array.isArray(pack.variants) && pack.variants.length === 4 &&
    Array.isArray(manifest.candidates) && manifest.candidates.length === 4,
    'JH_V2_PROVENANCE_INVALID');

  const ids = new Set();
  const validated = [];
  for (let i = 0; i < 4; i++) {
    const variant = pack.variants[i], row = manifest.candidates[i];
    const filename = 'candidate-' + (i + 1) + '.wav';
    requireTrue(row.file === filename && basename(row.file) === row.file &&
      row.id === 'jhadina-audition:' + variant.seed && row.seed === variant.seed &&
      row.variantId === variant.id && row.provider === 'qwen3-tts' && row.modelId === model &&
      row.voiceIdentityId === 'voice:jhadina:canonical:v1' &&
      row.state === 'candidate_unapproved' && row.qualityClaim === false &&
      typeof row.providerTaskId === 'string' && row.providerTaskId.trim().length > 0 &&
      !ids.has(row.providerTaskId) &&
      typeof row.artifactSha256 === 'string' && sha64.test(row.artifactSha256),
      'JH_V2_CANDIDATE_PROVENANCE_INVALID:' + filename);
    ids.add(row.providerTaskId);
    const wavPath = join(folder, filename);
    requireTrue(existsSync(wavPath) && statSync(wavPath).isFile(), 'JH_V2_WAV_MISSING:' + filename);
    const data = readFileSync(wavPath);
    requireTrue(data.length <= maxBytes && validWav(data) &&
      sha256(data) === row.artifactSha256,
      'JH_V2_WAV_HASH_OR_FORMAT_INVALID:' + filename);
    validated.push({ row, variant, wavPath });
  }
  return validated;
}

export function prepareRenderedVoicePack({
  sourceDir, outputDir = '.tmp/jhadina-voice-v2-prepared',
  packFile = 'docs/architecture/jhadina-candidate2-voice-v2-audition.json',
  ffmpeg = 'ffmpeg',
} = {}) {
  requireTrue(typeof sourceDir === 'string' && sourceDir.trim().length > 0,
    'JH_V2_SOURCE_DIR_REQUIRED');
  const root = resolve(process.cwd());
  const source = resolve(sourceDir);
  const dest = resolve(outputDir);
  requireTrue(dest.startsWith(root + '/') && source !== dest &&
    !source.startsWith(dest + '/') && !dest.startsWith(source + '/'),
    'JH_V2_UNSAFE_OUTPUT');
  const pack = JSON.parse(readFileSync(resolve(packFile), 'utf8'));
  const sourceManifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
  const validated = validateRenderedVoicePack(pack, sourceManifest, source);

  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  const candidates = [];
  for (let i = 0; i < validated.length; i++) {
    const { row, variant, wavPath } = validated[i];
    const mp3Name = 'candidate-' + (i + 1) + '.mp3';
    const mp3Path = join(dest, mp3Name);
    const result = spawnSync(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-i', wavPath, '-vn', '-ac', '1', '-codec:a', 'libmp3lame',
      '-q:a', '3', mp3Path,
    ], { encoding: 'utf8', timeout: 45000, maxBuffer: 1024 * 1024 });
    requireTrue(result.status === 0 && !result.error && existsSync(mp3Path),
      'JH_V2_FFMPEG_FAILED:' + mp3Name);
    const mp3 = readFileSync(mp3Path);
    requireTrue(mp3.length <= maxBytes && validMp3(mp3), 'JH_V2_MP3_FORMAT_INVALID:' + mp3Name);
    candidates.push({
      id: row.id, variantId: variant.id, file: mp3Name, seed: row.seed,
      state: 'candidate_unapproved', qualityClaim: false,
      provider: row.provider, providerTaskId: row.providerTaskId, modelId: row.modelId,
      voiceIdentityId: row.voiceIdentityId,
      sourceWavSha256: row.artifactSha256, mp3Sha256: sha256(mp3),
      mp3Bytes: mp3.length, speakerSimilarityMeasured: false,
      productionApproved: false,
    });
  }
  const output = {
    identity: sourceManifest.identity, profile: sourceManifest.profile,
    packId: pack.packId, sourceReference: pack.reference.candidateId,
    state: 'candidate_unapproved', qualityClaim: false, productionApproved: false,
    speakerSimilarityMeasured: false, candidates,
  };
  writeFileSync(join(dest, 'manifest.json'), JSON.stringify(output, null, 2) + '\n');
  return { outputDir: dest, candidates: candidates.length, status: 'unapproved_media_only' };
}
if (process.argv[1]?.endsWith('jhadina-voice-v2-prepare.mjs')) {
  try {
    console.log(JSON.stringify(prepareRenderedVoicePack({
      sourceDir: process.env.JHADINA_VOICE_V2_RENDER_DIR,
      outputDir: process.env.JHADINA_VOICE_V2_STAGING_DIR,
    }), null, 2));
  } catch(error) {
    console.error(String(error)); process.exitCode = 1;
  }
}
