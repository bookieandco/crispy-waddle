import {test} from "node:test"
import assert from "node:assert/strict"
import {createGateway} from "./server.mjs"
const secret="a-long-test-secret-at-least-32-bytes-long"
const data={model:"qwen3:4b",stream:false,format:"json",
 messages:[{role:"system",content:"Return a JSON DecisionProposal"},{role:"user",content:"Hello"}],
 options:{temperature:0.2,num_predict:512}}
async function fixture(fetchImpl,maxRequestsPerMinute=12){
 const server=createGateway({token:secret,model:"qwen3:4b",fetchImpl,maxRequestsPerMinute})
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve))
 const address=server.address()
 assert.equal(address.address,"127.0.0.1")
 return {server,url:`http://127.0.0.1:${address.port}`,
 close:()=>new Promise(resolve=>server.close(resolve))}
}
const call=(url,body=data,auth=secret)=>fetch(url+"/api/chat",{
 method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+auth},
 body:JSON.stringify(body)})
test("gateway refuses weak token, cloud alias or non-local bind",async()=>{
 assert.throws(()=>createGateway({token:"weak",model:"qwen3:4b"}),/GATEWAY_SECRET_REQUIRED/)
 assert.throws(()=>createGateway({token:secret,model:"gemma4:cloud"}),/LOCAL_MODEL_ONLY/)
 const g=await fixture(async()=>new Response("unused"))
 try{assert.equal(g.server.address().address,"127.0.0.1")}finally{await g.close()}
})
test("requires valid bearer even for health and never invokes Ollama when unauthorized",async()=>{
 let calls=0
 const g=await fixture(async()=>{calls++;return new Response("unexpected")})
 try{
  assert.equal((await call(g.url,data,"bad")).status,401)
  assert.equal((await fetch(g.url+"/health")).status,401)
  const health=await fetch(g.url+"/health",{headers:{authorization:"Bearer "+secret}})
  assert.equal(health.status,200)
  assert.equal((await health.json()).localInferenceConfirmed,false)
  assert.equal(calls,0)
 }finally{await g.close()}
})
test("allows only fixed model JSON inference and sends no model tools",async()=>{
 let sent
 const g=await fixture(async(url,init)=>{
  sent={url,request:JSON.parse(init.body)}
  return new Response(JSON.stringify({message:{content:'{"disposition":"DEFER","recommendation":"ok","rationale":"test"}'},eval_count:12}))
 })
 try{
  const res=await call(g.url)
  assert.equal(res.status,200)
  assert.equal((await res.json()).eval_count,12)
  assert.equal(sent.url,"http://127.0.0.1:11434/api/chat")
  assert.equal(sent.request.model,"qwen3:4b")
  assert.equal(sent.request.stream,false)
  assert.equal(sent.request.tools,undefined)
  assert.equal((await call(g.url,{...data,model:"gemma4:cloud"})).status,400)
  assert.equal((await call(g.url,{...data,tools:[{type:"function"}]})).status,400)
  assert.equal((await fetch(g.url+"/api/pull",{method:"POST",headers:{authorization:"Bearer "+secret}})).status,404)
 }finally{await g.close()}
})
test("rejects malformed and oversize requests without proxying them",async()=>{
 let calls=0
 const g=await fixture(async()=>{calls++;return new Response("unexpected")})
 try{
  const res=await fetch(g.url+"/api/chat",{method:"POST",
   headers:{"content-type":"application/json",authorization:"Bearer "+secret},
   body:"not json"})
  assert.equal(res.status,400)
  assert.equal((await call(g.url,{...data,messages:[{role:"user",content:"hi"}]})).status,400)
  const big=await fetch(g.url+"/api/chat",{method:"POST",
   headers:{"content-type":"application/json",authorization:"Bearer "+secret},
   body:JSON.stringify({...data,messages:[{role:"system",content:"s"},{role:"user",content:"x".repeat(260_001)}]})})
  assert.equal(big.status,413)
  assert.equal(calls,0)
 }finally{await g.close()}
})
test("rate-limit and in-flight guard prevent concurrent abuse",async()=>{
 let release
 const gate=new Promise(resolve=>{release=resolve})
 let entered=0
 const g=await fixture(async()=>{
  entered++;await gate
  return new Response(JSON.stringify({message:{content:"{}"}}))
 },2)
 try{
  const first=call(g.url)
  while(entered===0)await new Promise(resolve=>setTimeout(resolve,10))
  assert.equal((await call(g.url)).status,429)
  assert.equal((await call(g.url)).status,429)
  release()
  assert.equal((await first).status,200)
  assert.equal(entered,1)
 }finally{release();await g.close()}
})
