import { describe, expect, it } from 'vitest';
import {
  inspectDirectorReferenceImage,
  safeDirectorReferenceFilename,
} from './director-reference-media';

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a],0);
  bytes.set([0x00,0x00,0x00,0x0d],8);
  bytes.set([0x49,0x48,0x44,0x52],12);
  bytes[16]=(width>>>24)&0xff; bytes[17]=(width>>>16)&0xff; bytes[18]=(width>>>8)&0xff; bytes[19]=width&0xff;
  bytes[20]=(height>>>24)&0xff; bytes[21]=(height>>>16)&0xff; bytes[22]=(height>>>8)&0xff; bytes[23]=height&0xff;
  return bytes;
}

describe('Director reference media admission', () => {
  it('uses file signatures and dimensions rather than trusting the extension', () => {
    expect(inspectDirectorReferenceImage(png(1024,768),'image/png')).toEqual({
      mimeType:'image/png',
      width:1024,
      height:768,
    });
  });

  it('rejects a claimed MIME type that does not match bytes', () => {
    expect(() => inspectDirectorReferenceImage(png(1024,768),'image/jpeg'))
      .toThrow('DIRECTOR_REFERENCE_MIME_MISMATCH');
  });

  it('rejects tiny images before they can become identity references', () => {
    expect(() => inspectDirectorReferenceImage(png(64,64),'image/png'))
      .toThrow('DIRECTOR_REFERENCE_DIMENSIONS_INVALID');
  });

  it('normalizes uploaded filenames before using them in private object paths', () => {
    expect(safeDirectorReferenceFilename('../../ Ela face (final)!!.png'))
      .toBe('Ela-face-final-.png');
  });
});
