const ascii=(b:Uint8Array,start=0,end=b.length)=>new TextDecoder("latin1").decode(b.slice(start,end))
const starts=(b:Uint8Array,values:number[])=>b.length>=values.length&&values.every((v,i)=>b[i]===v)
const isTextLike=(b:Uint8Array)=>!b.slice(0,8192).some(v=>v===0)
const isZip=(b:Uint8Array)=>starts(b,[0x50,0x4b,0x03,0x04])||starts(b,[0x50,0x4b,0x05,0x06])||starts(b,[0x50,0x4b,0x07,0x08])

const signatures:[string,(b:Uint8Array)=>boolean][]=[
 ["image/png",b=>starts(b,[137,80,78,71,13,10,26,10])],
 ["image/jpeg",b=>starts(b,[0xff,0xd8,0xff])],
 ["application/pdf",b=>ascii(b,0,5)==="%PDF-"],
 ["audio/wav",b=>ascii(b,0,4)==="RIFF"&&ascii(b,8,12)==="WAVE"],
 ["audio/mpeg",b=>ascii(b,0,3)==="ID3"||(b[0]===0xff&&((b[1]??0)&0xe0)===0xe0)],
]

function detectOoxml(bytes:Uint8Array):string|undefined{
 if(!isZip(bytes))return undefined
 const head=ascii(bytes,0,Math.min(bytes.length,1_000_000))
 const tail=bytes.length>1_000_000?ascii(bytes,Math.max(0,bytes.length-1_000_000)):head
 const sample=head+tail
 if(sample.includes("word/"))return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
 if(sample.includes("xl/"))return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
 return undefined
}

export function detectArtifactMime(bytes:Uint8Array,declared:string):string{
 const ooxml=detectOoxml(bytes)
 if(ooxml)return ooxml
 if((declared==="audio/mp4"||declared==="video/mp4")&&bytes.length>=12&&ascii(bytes,4,8)==="ftyp")return declared
 if((declared==="audio/webm"||declared==="video/webm")&&starts(bytes,[0x1a,0x45,0xdf,0xa3]))return declared
 for(const [mime,test] of signatures)if(test(bytes))return mime
 if(declared==="application/json"&&isTextLike(bytes)){
  try{JSON.parse(new TextDecoder().decode(bytes));return "application/json"}catch{}
 }
 if((declared==="text/plain"||declared==="text/csv")&&isTextLike(bytes))return declared
 throw new Error("ARTIFACT_MIME_UNVERIFIED")
}
