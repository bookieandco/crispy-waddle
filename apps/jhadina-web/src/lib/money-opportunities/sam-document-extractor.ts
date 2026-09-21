import { inflateRawSync, inflateSync } from 'node:zlib'

export type SamDocumentExtraction={
  text:string|null
  status:'parsed'|'needs_ocr'|'unsupported'
  parser:string
}

const decode=(bytes:Uint8Array,encoding:BufferEncoding='utf8')=>Buffer.from(bytes).toString(encoding)
const clean=(value:string)=>value.replace(/\u0000/g,' ').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim()
const xmlEntities=(value:string)=>value
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
  .replace(/&quot;/g,'"').replace(/&apos;/g,"'")
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(Number.parseInt(n,16)))

function xmlText(xml:string){
  return clean(xmlEntities(xml
    .replace(/<w:tab\b[^>]*\/?\s*>/gi,'\t')
    .replace(/<w:br\b[^>]*\/?\s*>/gi,'\n')
    .replace(/<\/w:p>/gi,'\n')
    .replace(/<\/p>/gi,'\n')
    .replace(/<br\b[^>]*\/?\s*>/gi,'\n')
    .replace(/<[^>]+>/g,' ')))
}

function unzip(bytes:Uint8Array):Map<string,Uint8Array>{
  const buf=Buffer.from(bytes)
  const out=new Map<string,Uint8Array>()
  let eocd=-1
  for(let i=Math.max(0,buf.length-65557);i<=buf.length-22;i+=1){
    if(buf.readUInt32LE(i)===0x06054b50)eocd=i
  }
  if(eocd<0)throw new Error('ZIP_EOCD_NOT_FOUND')
  const count=buf.readUInt16LE(eocd+10)
  let cursor=buf.readUInt32LE(eocd+16)
  for(let i=0;i<count;i+=1){
    if(cursor+46>buf.length||buf.readUInt32LE(cursor)!==0x02014b50)throw new Error('ZIP_CENTRAL_DIRECTORY_INVALID')
    const method=buf.readUInt16LE(cursor+10)
    const compressedSize=buf.readUInt32LE(cursor+20)
    const nameLength=buf.readUInt16LE(cursor+28)
    const extraLength=buf.readUInt16LE(cursor+30)
    const commentLength=buf.readUInt16LE(cursor+32)
    const localOffset=buf.readUInt32LE(cursor+42)
    const name=buf.subarray(cursor+46,cursor+46+nameLength).toString('utf8')
    if(localOffset+30>buf.length||buf.readUInt32LE(localOffset)!==0x04034b50)throw new Error('ZIP_LOCAL_HEADER_INVALID')
    const localNameLength=buf.readUInt16LE(localOffset+26)
    const localExtraLength=buf.readUInt16LE(localOffset+28)
    const start=localOffset+30+localNameLength+localExtraLength
    const end=start+compressedSize
    if(end>buf.length)throw new Error('ZIP_ENTRY_OUT_OF_RANGE')
    const compressed=buf.subarray(start,end)
    let data:Buffer
    if(method===0)data=Buffer.from(compressed)
    else if(method===8)data=inflateRawSync(compressed)
    else{cursor+=46+nameLength+extraLength+commentLength;continue}
    out.set(name,new Uint8Array(data))
    cursor+=46+nameLength+extraLength+commentLength
  }
  return out
}

function extractDocx(bytes:Uint8Array){
  const entries=unzip(bytes)
  const names=[...entries.keys()].filter(n=>/^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(n))
  const text=clean(names.map(name=>xmlText(decode(entries.get(name)!))).filter(Boolean).join('\n'))
  return text||null
}

function extractXlsx(bytes:Uint8Array){
  const entries=unzip(bytes)
  const sharedXml=entries.get('xl/sharedStrings.xml')
  const shared=sharedXml
    ?[...decode(sharedXml).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map(m=>xmlText(m[1]))
    :[]
  const sheets=[...entries.entries()].filter(([name])=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
  const lines:string[]=[]
  for(const [,data] of sheets){
    const xml=decode(data)
    for(const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)){
      const cells:string[]=[]
      for(const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)){
        const attrs=cell[1],body=cell[2]
        const inline=body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/i)
        const raw=body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1]?.trim()
        let value=inline?xmlText(inline[1]):raw??''
        if(/\bt\s*=\s*["']s["']/i.test(attrs)&&raw&&/^\d+$/.test(raw))value=shared[Number(raw)]??raw
        if(value)cells.push(value)
      }
      if(cells.length)lines.push(cells.join('\t'))
    }
  }
  const text=clean(lines.join('\n'))
  return text||null
}

function pdfLiteral(value:string){
  return value.replace(/\\([nrtbf()\\])/g,(_,c)=>({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f','(':'(',')':')','\\':'\\'}[c]??c))
    .replace(/\\([0-7]{1,3})/g,(_,o)=>String.fromCharCode(Number.parseInt(o,8)))
}
function extractPdfOperators(source:string){
  const chunks:string[]=[]
  for(const m of source.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj\b/g))chunks.push(pdfLiteral(m[1]))
  for(const m of source.matchAll(/\[([\s\S]*?)\]\s*TJ\b/g)){
    for(const p of m[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g))chunks.push(pdfLiteral(p[1]))
  }
  for(const m of source.matchAll(/<([0-9a-fA-F]{4,})>\s*Tj\b/g)){
    try{chunks.push(Buffer.from(m[1].length%2?m[1]+'0':m[1],'hex').toString('latin1'))}catch{}
  }
  return chunks
}
function extractPdf(bytes:Uint8Array){
  const buf=Buffer.from(bytes)
  const raw=buf.toString('latin1')
  const chunks=extractPdfOperators(raw)
  const streamRe=/stream\r?\n/g
  for(const match of raw.matchAll(streamRe)){
    const start=(match.index??0)+match[0].length
    const end=raw.indexOf('endstream',start)
    if(end<0)continue
    const dictStart=Math.max(0,raw.lastIndexOf('<<',match.index??0))
    const dict=raw.slice(dictStart,match.index??0)
    if(!/FlateDecode/i.test(dict))continue
    const compressed=buf.subarray(start,end-(raw[end-1]==='\r'?1:0))
    try{
      const inflated=inflateSync(compressed).toString('latin1')
      chunks.push(...extractPdfOperators(inflated))
    }catch{}
  }
  const text=clean(chunks.join(' '))
  const alnum=(text.match(/[A-Za-z0-9]/g)??[]).length
  if(text.length<80||alnum/Math.max(1,text.length)<0.35)return null
  return text.slice(0,1_000_000)
}

function extractGenericZip(bytes:Uint8Array){
  const entries=unzip(bytes)
  const texts:string[]=[]
  for(const [name,data] of entries){
    const lower=name.toLowerCase()
    try{
      if(lower.endsWith('.txt')||lower.endsWith('.csv')||lower.endsWith('.xml')||lower.endsWith('.html')||lower.endsWith('.htm'))texts.push(lower.endsWith('.xml')||lower.endsWith('.html')||lower.endsWith('.htm')?xmlText(decode(data)):clean(decode(data)))
      else if(lower.endsWith('.docx')){const text=extractDocx(data);if(text)texts.push(text)}
      else if(lower.endsWith('.xlsx')){const text=extractXlsx(data);if(text)texts.push(text)}
      else if(lower.endsWith('.pdf')){const text=extractPdf(data);if(text)texts.push(text)}
    }catch{}
  }
  const text=clean(texts.join('\n\n'))
  return text||null
}

export function extractSamAttachmentText(input:{bytes:Uint8Array;contentType:string;sourceKind:string;url:string}):SamDocumentExtraction{
  const type=input.contentType.toLowerCase(),kind=input.sourceKind.toLowerCase(),path=new URL(input.url).pathname.toLowerCase()
  try{
    if(/^text\//.test(type)||/json|xml|csv|html/.test(type)||/\.(txt|csv|xml|html?|json)$/.test(path)){
      const text=clean(decode(input.bytes));return {text:text||null,status:text?'parsed':'unsupported',parser:'text-decoder'}
    }
    if(kind==='docx'||path.endsWith('.docx')||/wordprocessingml/.test(type)){
      const text=extractDocx(input.bytes);return {text,status:text?'parsed':'unsupported',parser:'docx-zip'}
    }
    if(kind==='xlsx'||/\.xlsx?$/.test(path)||/spreadsheetml|ms-excel/.test(type)){
      const text=extractXlsx(input.bytes);return {text,status:text?'parsed':'unsupported',parser:'xlsx-zip'}
    }
    if(kind==='pdf'||path.endsWith('.pdf')||type.includes('pdf')){
      const text=extractPdf(input.bytes);return {text,status:text?'parsed':'needs_ocr',parser:'pdf-text-operators'}
    }
    if(kind==='zip'||path.endsWith('.zip')||type.includes('zip')){
      const text=extractGenericZip(input.bytes);return {text,status:text?'parsed':'unsupported',parser:'zip-container'}
    }
  }catch{}
  return {text:null,status:'unsupported',parser:'none'}
}
