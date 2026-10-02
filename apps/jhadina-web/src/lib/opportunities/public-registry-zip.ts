import { inflateRawSync } from 'node:zlib'

export type ZipEntry={name:string;data:Buffer}
export type ZipTextEntry={name:string;text:string}

export function extractZipEntries(buffer:Buffer):ZipEntry[]{
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
  const out:ZipEntry[]=[]
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
    if(method===0)data=Buffer.from(compressed)
    else if(method===8)data=inflateRawSync(compressed)
    else continue
    out.push({name:fileName,data})
  }
  return out
}

export function extractZipTextEntries(buffer:Buffer):ZipTextEntry[]{
  return extractZipEntries(buffer).map(entry=>({
    name:entry.name,
    text:entry.data.toString('utf8'),
  }))
}

function xmlDecode(value:string):string{
  return value
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"')
    .replace(/&apos;/g,"'")
    .replace(/&amp;/g,'&')
    .replace(/&#(\d+);/g,(_match,raw)=>String.fromCodePoint(Number(raw)))
    .replace(/&#x([0-9a-f]+);/gi,(_match,raw)=>String.fromCodePoint(Number.parseInt(raw,16)))
}

function xmlText(value:string):string{
  return xmlDecode(
    [...value.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
      .map(match=>match[1]??'')
      .join(''),
  )
}

function columnIndex(reference:string):number{
  const letters=reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase()??''
  if(!letters)return-1
  let value=0
  for(const letter of letters)value=value*26+(letter.charCodeAt(0)-64)
  return value-1
}

function worksheetTsv(xml:string,shared:string[]):string{
  const lines:string[]=[]
  for(const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)){
    const values:string[]=[]
    let sequential=0
    for(const cell of rowMatch[1]!.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)){
      const attrs=cell[1]??''
      const body=cell[2]??''
      const ref=attrs.match(/\br\s*=\s*["']([^"']+)["']/i)?.[1]??''
      const index=columnIndex(ref)
      const target=index>=0?index:sequential
      sequential=Math.max(sequential,target+1)
      const raw=body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1]?.trim()??''
      const inline=body.match(/<is\b[^>]*>([\s\S]*?)<\/is>/i)?.[1]
      const type=attrs.match(/\bt\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
      let value=''
      if(inline!==undefined)value=xmlText(inline)
      else if(type==='s'&&/^\d+$/.test(raw))value=shared[Number(raw)]??''
      else value=xmlDecode(raw)
      while(values.length<=target)values.push('')
      values[target]=value.replace(/[\r\n\t]+/g,' ').trim()
    }
    while(values.length&&values.at(-1)==='')values.pop()
    if(values.some(value=>value.trim()))lines.push(values.join('\t'))
  }
  return lines.join('\n')
}

export function extractXlsxWorksheetTextEntries(buffer:Buffer):ZipTextEntry[]{
  const entries=extractZipEntries(buffer)
  const byName=new Map(entries.map(entry=>[entry.name,entry.data]))
  const sharedXml=byName.get('xl/sharedStrings.xml')?.toString('utf8')??''
  const shared=sharedXml
    ?[...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map(match=>xmlText(match[1]??''))
    :[]
  return entries
    .filter(entry=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.name))
    .map(entry=>({name:entry.name,text:worksheetTsv(entry.data.toString('utf8'),shared)}))
    .filter(entry=>entry.text.trim().length>0)
}
