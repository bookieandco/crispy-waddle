import { inflateRawSync } from 'node:zlib'

export type ZipTextEntry={name:string;text:string}

export function extractZipTextEntries(buffer:Buffer):ZipTextEntry[]{
  const EOCD=0x06054b50
  const CENTRAL=0x02014b50
  const LOCAL=0x04034b50
  let eocd=-1
  const floor=Math.max(0,buffer.length-65_557)
  for(let offset=buffer.length-22;offset>=floor;offset-=1){
    if(buffer.readUInt32LE(offset)===EOCD){eocd=offset;break}
  }
  if(eocd<0)throw new Error('public_registry_zip_eocd_missing')
  const entries=buffer.readUInt16LE(eocd+10)
  let cursor=buffer.readUInt32LE(eocd+16)
  const out:ZipTextEntry[]=[]
  for(let index=0;index<entries;index+=1){
    if(buffer.readUInt32LE(cursor)!==CENTRAL)throw new Error('public_registry_zip_central_directory_invalid')
    const method=buffer.readUInt16LE(cursor+10)
    const compressedSize=buffer.readUInt32LE(cursor+20)
    const fileNameLength=buffer.readUInt16LE(cursor+28)
    const extraLength=buffer.readUInt16LE(cursor+30)
    const commentLength=buffer.readUInt16LE(cursor+32)
    const localOffset=buffer.readUInt32LE(cursor+42)
    const fileName=buffer.subarray(cursor+46,cursor+46+fileNameLength).toString('utf8')
    cursor+=46+fileNameLength+extraLength+commentLength
    if(fileName.endsWith('/'))continue
    if(buffer.readUInt32LE(localOffset)!==LOCAL)throw new Error('public_registry_zip_local_header_invalid')
    const localNameLength=buffer.readUInt16LE(localOffset+26)
    const localExtraLength=buffer.readUInt16LE(localOffset+28)
    const dataStart=localOffset+30+localNameLength+localExtraLength
    const compressed=buffer.subarray(dataStart,dataStart+compressedSize)
    let data:Buffer
    if(method===0)data=compressed
    else if(method===8)data=inflateRawSync(compressed)
    else continue
    out.push({name:fileName,text:data.toString('utf8')})
  }
  return out
}
