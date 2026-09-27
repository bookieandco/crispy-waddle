const TEMPLATE_BASE64 = "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMPbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAjp0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAUAAAAC0AAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAAAAABAAAAAAGybWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAQABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABXW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAR1zdGJsAAAAuXN0c2QAAAAAAAAAAQAAAKlhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAUAAtABIAAAASAAAAAAAAAABFUxhdmM2MS4xOS4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAAL2F2Y0MBQsAL/+EAGGdCwAvaBQZ+fARAAAADAEAAAAMAg8UKqAEABGjOD8gAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAAY6AAAAAAAAAAYc3R0cwAAAAAAAAABAAAAAQAAQAAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAEAAAABAAAAFHN0c3oAAAAAAAADHQAAAAEAAAAUc3RjbwAAAAAAAAABAAADPwAAAGF1ZHRhAAAAWW1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALGlsc3QAAAAkqXRvbwAAABxkYXRhAAAAAQAAAABMYXZmNjEuNy4xMDMAAAAIZnJlZQAAAyVtZGF0AAACUwYF//9P3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzEwOCAzMWUxOWY5IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyMyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTAgcmVmPTEgZGVibG9jaz0wOjA6MCBhbmFseXNlPTA6MCBtZT1kaWEgc3VibWU9MCBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0wIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MCA4eDhkY3Q9MCBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0wIHRocmVhZHM9NiBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTAgd2VpZ2h0cD0wIGtleWludD0yNTAga2V5aW50X21pbj0xIHNjZW5lY3V0PTAgaW50cmFfcmVmcmVzaD0wIHJjPWNyZiBtYnRyZWU9MCBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0wAIAAAADCZYiEOiYoAAkCycnJycnJycnJycnJycnJycnJyddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddeA=";

function readU32(bytes:Uint8Array,offset:number):number{
  return new DataView(bytes.buffer,bytes.byteOffset+offset,4).getUint32(0,false);
}
function writeU32(bytes:Uint8Array,offset:number,value:number):void{
  new DataView(bytes.buffer,bytes.byteOffset+offset,4).setUint32(0,value>>>0,false);
}
function typeAt(bytes:Uint8Array,offset:number):string{
  return String.fromCharCode(...bytes.slice(offset,offset+4));
}
type Box={start:number;size:number;header:number;type:string};
function children(bytes:Uint8Array,start:number,end:number):Box[]{
  const result:Box[]=[];
  let cursor=start;
  while(cursor+8<=end){
    let size=readU32(bytes,cursor);
    const type=typeAt(bytes,cursor+4);
    let header=8;
    if(size===1){
      const high=readU32(bytes,cursor+8);
      const low=readU32(bytes,cursor+12);
      size=high*2**32+low;
      header=16;
    }else if(size===0){
      size=end-cursor;
    }
    if(size<header||cursor+size>end)break;
    result.push({start:cursor,size,header,type});
    cursor+=size;
  }
  return result;
}
function child(bytes:Uint8Array,parent:Box|undefined,type:string):Box|undefined{
  if(!parent)return undefined;
  return children(bytes,parent.start+parent.header,parent.start+parent.size).find(box=>box.type===type);
}
function top(bytes:Uint8Array,type:string):Box|undefined{
  return children(bytes,0,bytes.byteLength).find(box=>box.type===type);
}
function fullBoxPayload(box:Box):number{return box.start+box.header;}

export function createDirectorCertificationMp4(durationSeconds:number):Uint8Array{
  const seconds=Math.round(durationSeconds);
  if(!Number.isFinite(seconds)||seconds<1||seconds>3600)throw new Error('DIRECTOR_CERT_MP4_DURATION_INVALID');
  const bytes=new Uint8Array(Buffer.from(TEMPLATE_BASE64,'base64'));
  const moov=top(bytes,'moov');
  const mvhd=child(bytes,moov,'mvhd');
  const trak=child(bytes,moov,'trak');
  const tkhd=child(bytes,trak,'tkhd');
  const edts=child(bytes,trak,'edts');
  const elst=child(bytes,edts,'elst');
  const mdia=child(bytes,trak,'mdia');
  const mdhd=child(bytes,mdia,'mdhd');
  const minf=child(bytes,mdia,'minf');
  const stbl=child(bytes,minf,'stbl');
  const stts=child(bytes,stbl,'stts');
  if(!mvhd||!tkhd||!elst||!mdhd||!stts)throw new Error('DIRECTOR_CERT_MP4_TEMPLATE_INVALID');

  const mvhdPayload=fullBoxPayload(mvhd);
  const tkhdPayload=fullBoxPayload(tkhd);
  const elstPayload=fullBoxPayload(elst);
  const mdhdPayload=fullBoxPayload(mdhd);
  const sttsPayload=fullBoxPayload(stts);
  if(bytes[mvhdPayload]!==0||bytes[tkhdPayload]!==0||bytes[elstPayload]!==0||bytes[mdhdPayload]!==0){
    throw new Error('DIRECTOR_CERT_MP4_VERSION_UNSUPPORTED');
  }
  const movieTimescale=readU32(bytes,mvhdPayload+12);
  const mediaTimescale=readU32(bytes,mdhdPayload+12);
  writeU32(bytes,mvhdPayload+16,movieTimescale*seconds);
  writeU32(bytes,tkhdPayload+20,movieTimescale*seconds);
  writeU32(bytes,elstPayload+8,movieTimescale*seconds);
  writeU32(bytes,mdhdPayload+16,mediaTimescale*seconds);
  writeU32(bytes,sttsPayload+12,mediaTimescale*seconds);
  return bytes;
}

export function readDirectorCertificationMp4Duration(bytes:Uint8Array):number{
  const moov=top(bytes,'moov');
  const mvhd=child(bytes,moov,'mvhd');
  if(!mvhd)throw new Error('DIRECTOR_CERT_MP4_MVHD_MISSING');
  const payload=fullBoxPayload(mvhd);
  if(bytes[payload]!==0)throw new Error('DIRECTOR_CERT_MP4_VERSION_UNSUPPORTED');
  const timescale=readU32(bytes,payload+12);
  const duration=readU32(bytes,payload+16);
  if(!timescale||!duration)throw new Error('DIRECTOR_CERT_MP4_DURATION_MISSING');
  return duration/timescale;
}
