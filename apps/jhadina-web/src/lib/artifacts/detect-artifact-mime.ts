const signatures:[string,(b:Uint8Array)=>boolean][]=[
 ["image/png",b=>b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)],
 ["image/jpeg",b=>b[0]===0xff&&b[1]===0xd8&&b[2]===0xff],
 ["application/pdf",b=>new TextDecoder().decode(b.slice(0,5))==="%PDF-"],
 ["audio/wav",b=>new TextDecoder().decode(b.slice(0,4))==="RIFF"&&new TextDecoder().decode(b.slice(8,12))==="WAVE"],
]
export function detectArtifactMime(bytes:Uint8Array,declared:string):string{
 for(const [mime,test] of signatures) if(test(bytes)) return mime
 if(declared==="text/plain"){
  const sample=bytes.slice(0,4096); if(!sample.some(v=>v===0)) return "text/plain"
 }
 throw new Error("ARTIFACT_MIME_UNVERIFIED")
}
