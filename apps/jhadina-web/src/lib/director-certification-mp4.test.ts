import { describe, expect, it } from 'vitest';
import {
  createDirectorCertificationMp4,
  readDirectorCertificationMp4Duration,
} from './director-certification-mp4';

describe('Director certification MP4',()=>{
  for(const duration of [30,600,1500,3600]){
    it('creates a valid timing receipt for '+duration+' seconds',()=>{
      const bytes=createDirectorCertificationMp4(duration);
      expect(bytes.byteLength).toBeGreaterThan(1000);
      expect(String.fromCharCode(...bytes.slice(4,8))).toBe('ftyp');
      expect(readDirectorCertificationMp4Duration(bytes)).toBe(duration);
    });
  }
  it('rejects durations outside the certification matrix boundary',()=>{
    expect(()=>createDirectorCertificationMp4(0)).toThrow('DIRECTOR_CERT_MP4_DURATION_INVALID');
    expect(()=>createDirectorCertificationMp4(3601)).toThrow('DIRECTOR_CERT_MP4_DURATION_INVALID');
  });
});
