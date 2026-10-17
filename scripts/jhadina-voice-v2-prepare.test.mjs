import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { prepareRenderedVoicePack, validateRenderedVoicePack } from './jhadina-voice-v2-prepare.mjs';

const pack = JSON.parse(readFileSync('docs/architecture/jhadina-candidate2-voice-v2-audition.json', 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function pcmWav() {
  const samples = 24000, bytes = samples * 2;
  const output = Buffer.alloc(44 + bytes);
  output.write('RIFF', 0);
  output.writeUInt32LE(output.length - 8, 4);
  output.write('WAVE', 8);
  output.write('fmt ', 12);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(16000, 24);
  output.writeUInt32LE(32000, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write('data', 36);
  output.writeUInt32LE(bytes, 40);
  for(let i=0;i<samples;i++) {
    output.writeInt16LE(Math.round(Math.sin(2*Math.PI*220*i/16000)*14000),44+i*2);
  }
  return output;
}

function mockRender() {
  const folder=mkdtempSync(join(tmpdir(),'jh-v2-src-'));
  const candidates=pack.variants.map((v,index)=>{
    const filename='candidate-'+(index+1)+'.wav';
    const data=pcmWav();
    writeFileSync(join(folder,filename),data);
    return {
      id:'jhadina-audition:'+v.seed, file:filename,
      seed:v.seed,variantId:v.id,
      provider:'qwen3-tts', providerTaskId:'distinct-provider-task-'+index,
      modelId:'Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign',
      voiceIdentityId:'voice:jhadina:canonical:v1',
      artifactSha256:sha256(data), state:'candidate_unapproved',qualityClaim:false,
    };
  });
  const manifest={identity:'voice:jhadina:canonical:v1',profile:'jhadina:canonical',
    packId:pack.packId,state:'candidate_unapproved',qualityClaim:false,candidates};
  writeFileSync(join(folder,'manifest.json'),JSON.stringify(manifest,null,2));
  return {folder,manifest};
}

describe('JH-VOICE-HOST.07 unapproved render bridge',()=>{
  it('rejects fabricated wav hashes, provider receipts and production authority',()=>{
    const {folder,manifest}=mockRender();
    try {
      assert.equal(validateRenderedVoicePack(pack,manifest,folder).length,4);
      const changed=structuredClone(manifest);
      changed.candidates[1].artifactSha256='f'.repeat(64);
      assert.throws(()=>validateRenderedVoicePack(pack,changed,folder),/WAV_HASH/);
      const fake=structuredClone(manifest);
      fake.candidates[2].providerTaskId=fake.candidates[0].providerTaskId;
      assert.throws(()=>validateRenderedVoicePack(pack,fake,folder),/PROVENANCE/);
      const approved=structuredClone(manifest);
      approved.candidates[0].state='approved';
      assert.throws(()=>validateRenderedVoicePack(pack,approved,folder),/PROVENANCE/);
      const other=structuredClone(manifest);
      other.candidates[0].seed=1001;
      assert.throws(()=>validateRenderedVoicePack(pack,other,folder),/PROVENANCE/);
      const empty=structuredClone(manifest);
      empty.candidates.pop();
      assert.throws(()=>validateRenderedVoicePack(pack,empty,folder),/PROVENANCE/);
    } finally {rmSync(folder,{recursive:true,force:true});}
  });
  it('converts only hash-bound WAV fixtures into unapproved, individually hashed MP3s',()=>{
    const {folder}=mockRender(),dest=resolve('.tmp/jhadina-voice-v2-prepare-source-test');
    try {
      const version=spawnSync('ffmpeg',['-version'],{encoding:'utf8'});
      if (version.status!==0) throw Error('FFMPEG_REQUIRED_FOR_V2_TEST');
      const result=prepareRenderedVoicePack({sourceDir:folder,outputDir:dest});
      assert.equal(result.status,'unapproved_media_only');
      assert.equal(result.candidates,4);
      const manifest=JSON.parse(readFileSync(join(dest,'manifest.json'),'utf8'));
      assert.equal(manifest.productionApproved,false);
      assert.equal(manifest.speakerSimilarityMeasured,false);
      assert.equal(manifest.candidates.length,4);
      manifest.candidates.forEach((candidate,index)=>{
        assert.equal(candidate.variantId,pack.variants[index].id);
        assert.equal(candidate.state,'candidate_unapproved');
        assert.equal(candidate.productionApproved,false);
        assert.equal(candidate.speakerSimilarityMeasured,false);
        assert.equal(existsSync(join(dest,candidate.file)),true);
        const binary=readFileSync(join(dest,candidate.file));
        assert.equal(sha256(binary),candidate.mp3Sha256);
        assert.ok(binary.length<=25*1024*1024);
      });
    } finally {
      rmSync(folder,{recursive:true,force:true});
      rmSync(dest,{recursive:true,force:true});
    }
  });
});
