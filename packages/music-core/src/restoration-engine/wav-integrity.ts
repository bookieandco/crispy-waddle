/** Strict decoded-frame admission for untrusted restoration worker WAV bytes.
 * Source format remains untouched; this only verifies derivative metadata.
 */
export function inspectRestorationWav(bytes:Uint8Array): {
  sampleRate:number; channels:number; sampleCount:number;
} {
  if(bytes.byteLength<44||bytes.byteLength>128*1024*1024)
    throw new Error("MUSIC_RESTORATION_WAV_SIZE_INVALID");
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const word=(offset:number)=>String.fromCharCode(
    view.getUint8(offset),view.getUint8(offset+1),
    view.getUint8(offset+2),view.getUint8(offset+3));
  if(word(0)!=="RIFF"||word(8)!=="WAVE"||view.getUint32(4,true)+8!==bytes.byteLength)
    throw new Error("MUSIC_RESTORATION_WAV_RIFF_INVALID");
  let sampleRate=0,channels=0,align=0,format=0,bits=0,dataSize=-1;
  for(let cursor=12;cursor+8<=bytes.byteLength;){
    const name=word(cursor),length=view.getUint32(cursor+4,true);
    const start=cursor+8,end=start+length;
    if(end>bytes.byteLength)throw new Error("MUSIC_RESTORATION_WAV_CHUNK_INVALID");
    if(name==="fmt "){
      if(sampleRate||length<16)throw new Error("MUSIC_RESTORATION_WAV_FMT_INVALID");
      format=view.getUint16(start,true);channels=view.getUint16(start+2,true);
      sampleRate=view.getUint32(start+4,true);
      align=view.getUint16(start+12,true);bits=view.getUint16(start+14,true);
      if(!((format===1&&[16,24,32].includes(bits))||(format===3&&bits===32))||
         channels<1||channels>8||sampleRate<8000||sampleRate>192000||
         align!==channels*(bits/8)||
         view.getUint32(start+8,true)!==sampleRate*align)
        throw new Error("MUSIC_RESTORATION_WAV_FORMAT_UNSUPPORTED");
    }else if(name==="data"){
      if(dataSize!==-1)throw new Error("MUSIC_RESTORATION_WAV_DUPLICATE_DATA");
      dataSize=length;
      if(format===3){
        for(let k=start;k<end;k+=4)
          if(!Number.isFinite(view.getFloat32(k,true)))
            throw new Error("MUSIC_RESTORATION_WAV_NONFINITE");
      }
    }
    cursor=end+(length&1);
  }
  if(!sampleRate||dataSize<=0||dataSize%align!==0)
    throw new Error("MUSIC_RESTORATION_WAV_DATA_INVALID");
  return {sampleRate,channels,sampleCount:dataSize/align};
}
