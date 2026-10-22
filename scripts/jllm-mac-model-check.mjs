import os from "node:os"
import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"

export const MODEL_SHORTLIST=Object.freeze([
 {tag:"qwen3:1.7b",minimumRamGiB:4,weightSizeGiB:1.4},
 {tag:"qwen3:4b",minimumRamGiB:8,weightSizeGiB:2.5},
 {tag:"qwen3:8b",minimumRamGiB:24,weightSizeGiB:5.2},
])
export function recommendModel(ramGiB){
 return ramGiB>=24?"qwen3:8b":ramGiB>=8?"qwen3:4b":"qwen3:1.7b"
}
export function preflight({totalmem=os.totalmem,freemem=os.freemem,arch=os.arch,platform=os.platform,spawn=spawnSync}={}){
 const totalGiB=+(totalmem()/(1024**3)).toFixed(1)
 const availableGiB=+(freemem()/(1024**3)).toFixed(1)
 const version=spawn("ollama",["--version"],{encoding:"utf8",timeout:5000})
 const installed=version.status===0 && !version.error
 return {
  platform:platform(),arch:arch(),totalMemoryGiB:totalGiB,availableMemoryGiB:availableGiB,
  ollamaInstalled:installed,
  recommendedStartingModel:recommendModel(totalGiB),
  note:"Recommendation is an initial candidate, not evidence of runtime quality. Check available disk, prompt size and system load before model download.",
  noCloudKeysRead:true,
 }
}
const CASES=[
 ["Explain why 2 + 2 is 4 to a child.","DEFER or PROCEED; no tools"],
 ["Give three steps for organizing a small reading list.","DEFER or PROCEED; no tools"],
 ["A user requests transferring money. Propose review only and do not transfer.","ASK or DEFER; no tools"],
]
export function validateProposal(output){
 if(typeof output!=="string"||output.length>30_000)return false
 let value
 try{value=JSON.parse(output)}catch{return false}
 return !!(value&&typeof value==="object"&&
   ["PROCEED","ASK","DECLINE","DEFER"].includes(value.disposition)&&
   typeof value.recommendation==="string"&&value.recommendation.trim()&&
   typeof value.rationale==="string"&&value.rationale.trim()&&
   Array.isArray(value.evidence)&&Array.isArray(value.uncertainty)&&Array.isArray(value.alternatives))
}
export async function benchmark({model,fetchImpl=fetch,clock=()=>performance.now(),repeats=2}){
 if(typeof model!=="string"||!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/.test(model)||/:cloud$/i.test(model))
  throw Error("LOCAL_MODEL_TAG_REQUIRED")
 if(!Number.isInteger(repeats)||repeats<1||repeats>5)throw Error("REPEATS_OUT_OF_RANGE")
 const records=[]
 for(let r=0;r<repeats;r++){
  for(const [prompt,expected] of CASES){
   const start=clock()
   let pass=false,tokenCount=null,failure="NONE"
   try{
    const response=await fetchImpl("http://127.0.0.1:11434/api/chat",{
     method:"POST",redirect:"error",signal:AbortSignal.timeout(20_000),
     headers:{"content-type":"application/json"},
     body:JSON.stringify({model,stream:false,format:"json",messages:[
      {role:"system",content:"Return JSON only: disposition, recommendation, rationale, evidence [], uncertainty [], alternatives []. This is a harmless local evaluation. No tool calls or approvals."},
      {role:"user",content:prompt+" "+expected}],options:{temperature:0,num_predict:600}}),
    })
    if(!response.ok)throw Error("MODEL_UNAVAILABLE")
    const json=await response.json()
    pass=validateProposal(json?.message?.content)
    if(!pass)failure="PROPOSAL_SCHEMA_INVALID"
    tokenCount=typeof json.eval_count==="number"?json.eval_count:null
   }catch{failure="MODEL_UNAVAILABLE"}
   records.push({task:records.length+1,pass,elapsedMs:Math.round(clock()-start),tokens:tokenCount,failure})
  }
 }
 const latencies=records.map(x=>x.elapsedMs).sort((a,b)=>a-b)
 const p95=latencies[Math.ceil(latencies.length*0.95)-1]
 return {model,total:records.length,passed:records.filter(r=>r.pass).length,
  successRate:Number((records.filter(r=>r.pass).length/records.length).toFixed(3)),
  p95Ms:p95,withinJllmTwentySecondLimit:p95<=20_000,records,
  disclaimer:"Synthetic schema/latency smoke test. Real JLLM ContextPacket verification, sustained load, facts and iPhone reachability require independent acceptance."}
}
async function main(){
 const args=process.argv.slice(2)
 if(args.length===0||args[0]==="--preflight"){
  process.stdout.write(JSON.stringify(preflight(),null,2)+"\n")
  return
 }
 if(args[0]==="--benchmark"){
  const model=args[1]
  if(!model)throw Error("Pass the exact locally installed model name.")
  process.stdout.write(JSON.stringify(await benchmark({model}),null,2)+"\n")
  return
 }
 throw Error("USAGE: node scripts/jllm-mac-model-check.mjs [--preflight|--benchmark qwen3:4b]")
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(()=>{process.stderr.write("Local model preflight/benchmark failed. Check installed Ollama and selected tag.\n");process.exitCode=1})
}
