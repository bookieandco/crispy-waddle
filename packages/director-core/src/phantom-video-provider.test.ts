import { describe, expect, it } from 'vitest';
import {
  buildPhantomVideoRequest,
  phantomCliArguments,
  validatePhantomVideoRequest,
  type PhantomVideoReference,
} from './phantom-video-provider.js';

const ref=(id:string):PhantomVideoReference=>({
  id,
  role:'character',
  assetId:`asset:${id}`,
  uri:`https://signed.example/${id}.png`,
  sha256:'a'.repeat(64),
  description:`locked reference ${id}`,
  evidenceIds:[`evidence:${id}`],
});

describe('Phantom-Wan Director provider contract',()=>{
  it('defaults rehearsal to 1.3B and final takes to 14B',()=>{
    const rehearsal=buildPhantomVideoRequest({
      requestId:'r1',projectId:'p',purpose:'rehearsal',prompt:'A locked character crosses the room.',
      references:[ref('a')],durationSeconds:3,seed:42,
    });
    expect(rehearsal.model).toBe('phantom-wan-1.3b');
    expect(rehearsal.task).toBe('s2v-1.3B');
    expect(rehearsal.size).toBe('832*480');

    const final=buildPhantomVideoRequest({
      requestId:'r2',projectId:'p',purpose:'final-take',prompt:'A locked character crosses the room.',
      references:[ref('a')],durationSeconds:5,seed:42,
    });
    expect(final.model).toBe('phantom-wan-14b');
    expect(final.task).toBe('s2v-14B');
    expect(final.size).toBe('1280*720');
    expect(final.stabilityNotes.join(' ')).toContain('480P');
  });

  it('enforces Phantom reference and shot-duration limits instead of silently degrading',()=>{
    expect(()=>buildPhantomVideoRequest({
      requestId:'r',projectId:'p',purpose:'final-take',prompt:'shot',references:[ref('1'),ref('2'),ref('3'),ref('4'),ref('5')],
      durationSeconds:5,seed:1,
    })).toThrow('DIRECTOR_PHANTOM_REQUEST_INVALID');
    expect(()=>buildPhantomVideoRequest({
      requestId:'r',projectId:'p',purpose:'final-take',prompt:'shot',references:[ref('1')],
      durationSeconds:11,seed:1,
    })).toThrow('DIRECTOR_PHANTOM_SHOT_DURATION_INVALID');
  });

  it('keeps the 4n+1 frame invariant and exact runtime lineage',()=>{
    const request=buildPhantomVideoRequest({
      requestId:'r',projectId:'p',purpose:'final-take',prompt:'shot',references:[ref('1'),ref('2')],
      durationSeconds:5,seed:7,
    });
    expect((request.frameNum-1)%4).toBe(0);
    expect(validatePhantomVideoRequest(request)).toEqual([]);
    expect(phantomCliArguments(request,{
      ckptDir:'/models/Wan2.1-T2V-1.3B',
      phantomCheckpoint:'/models/Phantom-Wan-Models',
      referencePaths:['/work/ref1.png','/work/ref2.png'],
      outputPath:'/work/out.mp4',
    })).toEqual(expect.arrayContaining([
      '--task','s2v-14B',
      '--ref_image','/work/ref1.png,/work/ref2.png',
      '--base_seed','7',
      '--save_file','/work/out.mp4',
    ]));
  });

  it('rejects 720p on Phantom-Wan-1.3B because upstream only admits 832*480',()=>{
    const request=buildPhantomVideoRequest({
      requestId:'r',projectId:'p',purpose:'draft',prompt:'shot',references:[ref('1')],
      durationSeconds:3,seed:1,
    });
    expect(validatePhantomVideoRequest({...request,size:'1280*720'})).toContain('DIRECTOR_PHANTOM_1_3B_SIZE_UNSUPPORTED');
  });
});
