import {describe,expect,it} from 'vitest';
import {buildJuggernautSectionsFromPerception} from './music-section-perception-bridge';

describe('Music section perception bridge',()=>{
  it('converts measured sample boundaries to evidence-backed Juggernaut sections',()=>{
    const sections=buildJuggernautSectionsFromPerception({
      songId:'song-1',
      artifactId:'artifact-1',
      perception:{
        artifactId:'artifact-1',
        runtimeReceiptId:'receipt-1',
        sampleRate:48000,
        sections:[
          {id:'a',startSample:0,endSample:480000,label:'Intro',confidence:0.8,evidenceIds:['evidence:a']},
          {id:'b',startSample:480000,endSample:1440000,label:'Hook',confidence:0.9,evidenceIds:['evidence:b']},
        ],
        beatCount:40,downbeatCount:10,sectionCount:2,transientCount:25,
      },
    });
    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      startMs:0,endMs:10000,label:'Intro',functions:['performance'],
      sourceArtifactId:'artifact-1',runtimeReceiptId:'receipt-1',
    });
    expect(sections[1]?.startMs).toBe(10000);
    expect(sections[1]?.endMs).toBe(30000);
    expect(sections[1]?.evidenceRefs).toContain('evidence:b');
  });

  it('fails closed on low-confidence or invalid boundaries',()=>{
    const sections=buildJuggernautSectionsFromPerception({
      songId:'song-1',
      artifactId:'artifact-1',
      minimumConfidence:0.6,
      perception:{
        artifactId:'artifact-1',
        runtimeReceiptId:'receipt-1',
        sampleRate:44100,
        sections:[
          {id:'low',startSample:0,endSample:44100,label:'Low',confidence:0.4,evidenceIds:['low']},
          {id:'bad',startSample:44100,endSample:44100,label:'Bad',confidence:0.9,evidenceIds:['bad']},
        ],
        beatCount:0,downbeatCount:0,sectionCount:2,transientCount:0,
      },
    });
    expect(sections).toHaveLength(0);
  });
});
