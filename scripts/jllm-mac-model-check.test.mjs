import {test} from "node:test"
import assert from "node:assert/strict"
import {preflight,recommendModel,benchmark,validateProposal} from "./jllm-mac-model-check.mjs"
test("resource preflight makes no network calls or installs",()=>{
 let invoked=0
 const x=preflight({totalmem:()=>8*(1024**3),freemem:()=>4*(1024**3),arch:()=>"arm64",platform:()=>"darwin",
  spawn:(binary,args)=>{invoked++;assert.equal(binary,"ollama");assert.deepEqual(args,["--version"]);return{status:0}}})
 assert.deepEqual({model:x.recommendedStartingModel,arch:x.arch,platform:x.platform,hasOllama:x.ollamaInstalled},
 {model:"qwen3:4b",arch:"arm64",platform:"darwin",hasOllama:true})
 assert.equal(invoked,1)
 assert.equal(x.noCloudKeysRead,true)
})
test("recommendations are conservative hardware candidates, not proof",()=>{
 assert.equal(recommendModel(4),"qwen3:1.7b")
 assert.equal(recommendModel(8),"qwen3:4b")
 assert.equal(recommendModel(16),"qwen3:4b")
 assert.equal(recommendModel(24),"qwen3:8b")
})
test("benchmarks only loopback, explicit installed tag, and fixed harmless prompts",async()=>{
 let urls=[],payloads=[]
 let tick=0
 const result=await benchmark({model:"qwen3:4b",repeats:1,clock:()=>++tick*500,
 fetchImpl:async(url,init)=>{urls.push(String(url));payloads.push(JSON.parse(init.body));
  return new Response(JSON.stringify({message:{content:JSON.stringify({
   disposition:"DEFER",recommendation:"test only",rationale:"synthetic",evidence:[],uncertainty:[],alternatives:[],
  })},eval_count:15}),{status:200})}})
 assert.equal(result.total,3)
 assert.equal(result.passed,3)
 assert.equal(result.successRate,1)
 assert(urls.every(u=>u==="http://127.0.0.1:11434/api/chat"))
 assert(payloads.every(x=>x.stream===false&&x.format==="json"&&x.tools===undefined))
 assert.equal(result.withinJllmTwentySecondLimit,true)
})
test("invalid tags and malformed model JSON fail without network",async()=>{
 let calls=0
 await assert.rejects(()=>benchmark({model:"https://cloud.example",fetchImpl:async()=>{calls++}}),/LOCAL_MODEL_TAG_REQUIRED/)
 await assert.rejects(()=>benchmark({model:"other:cloud",fetchImpl:async()=>{calls++}}),/LOCAL_MODEL_TAG_REQUIRED/)
 assert.equal(calls,0)
 assert.equal(validateProposal('{"disposition":"PROCEED"}'),false)
})
