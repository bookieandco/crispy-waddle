import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import JSZip from "npm:jszip@3.10.1"

type RequestBody={base64?:string;contentType?:string;fileName?:string}
const MAX_BYTES=4_000_000
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}})
const decode=(value:string)=>{
  const binary=atob(value)
  if(binary.length>MAX_BYTES)throw new Error("DOCUMENT_TOO_LARGE_FOR_EXTRACTOR")
  const bytes=new Uint8Array(binary.length)
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i)
  return bytes
}
const entities=(s:string)=>s
  .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&")
  .replace(/&quot;/g,'"').replace(/&apos;/g,"'")
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
const xmlText=(xml:string)=>entities(xml
  .replace(/<w:tab\s*\/>/g,"\t")
  .replace(/<w:br\s*\/>/g,"\n")
  .replace(/<\/w:p>/g,"\n")
  .replace(/<[^>]+>/g," ")
  .replace(/[ \t]+/g," ")
  .replace(/\n\s+/g,"\n")
  .trim())

async function parseDocx(bytes:Uint8Array){
  const zip=await JSZip.loadAsync(bytes)
  const doc=zip.file("word/document.xml")
  if(!doc)throw new Error("DOCX_DOCUMENT_XML_MISSING")
  return xmlText(await doc.async("string"))
}
async function parseXlsx(bytes:Uint8Array){
  const zip=await JSZip.loadAsync(bytes)
  const sharedFile=zip.file("xl/sharedStrings.xml")
  const shared:string[]=[]
  if(sharedFile){
    const xml=await sharedFile.async("string")
    for(const m of xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g))shared.push(xmlText(m[1]))
  }
  const names=Object.keys(zip.files).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()
  const sheets:string[]=[]
  for(const name of names){
    const file=zip.file(name);if(!file)continue
    const xml=await file.async("string")
    const out:string[]=[]
    for(const match of xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
      const attrs=match[1],body=match[2]
      const v=body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1]??body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1]??""
      if(!v)continue
      const value=/\bt="s"/.test(attrs)?shared[Number(v)]??v:entities(v)
      if(value)out.push(value)
    }
    if(out.length)sheets.push(out.join("\t"))
  }
  if(!sheets.length)throw new Error("XLSX_NO_EXTRACTABLE_CELLS")
  return sheets.join("\n")
}
async function parsePdf(bytes:Uint8Array){
  const pdfjs=await import("npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs")
  const task=pdfjs.getDocument({data:bytes,disableWorker:true,useSystemFonts:true})
  const pdf=await task.promise
  const pages:string[]=[]
  for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i)
    const content=await page.getTextContent()
    const line=content.items.map((item:unknown)=>{
      const row=item as {str?:unknown}
      return typeof row.str==="string"?row.str:""
    }).filter(Boolean).join(" ")
    if(line)pages.push(line)
  }
  await pdf.destroy()
  if(!pages.length)throw new Error("PDF_NO_EXTRACTABLE_TEXT")
  return pages.join("\n\n")
}
function kind(contentType:string,fileName:string){
  const name=fileName.toLowerCase(),type=contentType.toLowerCase()
  if(type.includes("pdf")||name.endsWith(".pdf"))return"pdf"
  if(type.includes("wordprocessingml")||name.endsWith(".docx"))return"docx"
  if(type.includes("spreadsheetml")||name.endsWith(".xlsx"))return"xlsx"
  if(type.startsWith("text/")||type.includes("json")||type.includes("xml")||type.includes("csv")||name.endsWith(".txt")||name.endsWith(".csv"))return"text"
  return"unsupported"
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405)
  try{
    const body=await req.json() as RequestBody
    if(!body.base64)return json({ok:false,error:"MISSING_DOCUMENT"},400)
    const bytes=decode(body.base64)
    const contentType=body.contentType??"application/octet-stream"
    const fileName=body.fileName??"document"
    const parser=kind(contentType,fileName)
    let text=""
    if(parser==="pdf")text=await parsePdf(bytes)
    else if(parser==="docx")text=await parseDocx(bytes)
    else if(parser==="xlsx")text=await parseXlsx(bytes)
    else if(parser==="text")text=new TextDecoder().decode(bytes)
    else return json({ok:false,error:"UNSUPPORTED_DOCUMENT_TYPE",parser},415)
    const cleaned=text.replace(/\u0000/g,"").trim().slice(0,1_000_000)
    if(!cleaned)return json({ok:false,error:"NO_EXTRACTABLE_TEXT",parser},422)
    return json({ok:true,parser,text:cleaned,characters:cleaned.length})
  }catch(error){
    const message=error instanceof Error?error.message:"DOCUMENT_EXTRACTION_FAILED"
    const status=message==="DOCUMENT_TOO_LARGE_FOR_EXTRACTOR"?413:422
    return json({ok:false,error:message},status)
  }
})
