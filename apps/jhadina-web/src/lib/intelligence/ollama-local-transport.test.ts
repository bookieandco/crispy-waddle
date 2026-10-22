import {describe,it,expect,vi} from "vitest"
import {createOllamaLocalInferenceTransport,resolveLocalModelConnection,validateLocalModelEndpoint} from "./ollama-local-transport"

const local={baseUrl:"http://127.0.0.1:11434",model:"qwen3:4b",production:false}
const gateway={baseUrl:"https://private-owner.example",model:"qwen3:4b",production:true,
 allowedHost:"private-owner.example",token:"example-private-token"}

describe("local JLLM inference boundary",()=>{
 it("rejects unapproved production HTTP/host/token configurations",()=>{
  expect(()=>validateLocalModelEndpoint({...local,production:true})).toThrow(/PRIVATE_GATEWAY_REQUIRED/)
  expect(()=>validateLocalModelEndpoint({...gateway,allowedHost:"wrong.example"})).toThrow(/PRIVATE_GATEWAY_REQUIRED/)
  expect(()=>validateLocalModelEndpoint({...gateway,token:undefined})).toThrow(/PRIVATE_GATEWAY_REQUIRED/)
  expect(()=>validateLocalModelEndpoint({...local,baseUrl:"http://192.168.1.3:11434"})).toThrow(/PRIVATE_GATEWAY_REQUIRED/)
  expect(()=>validateLocalModelEndpoint({...gateway,baseUrl:"https://private-owner.example@attacker.example"})).toThrow()
  expect(()=>validateLocalModelEndpoint({...gateway,baseUrl:"https://private-owner.example/other"})).toThrow(/URL_INVALID/)
 })
 it("allows local loopback only in nonproduction or explicit HTTPS gateway",()=>{
  expect(validateLocalModelEndpoint(local).href).toBe("http://127.0.0.1:11434/api/chat")
  expect(validateLocalModelEndpoint(gateway).href).toBe("https://private-owner.example/api/chat")
 })
 it("uses bounded Ollama JSON protocol and never forwards secrets in URL",async()=>{
  let sentUrl=""
  let sent:RequestInit|undefined
  const fake=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
   sentUrl=String(url);sent=init
   return new Response(JSON.stringify({message:{content:"{\"disposition\":\"DEFER\"}"},prompt_eval_count:10,eval_count:3}),{status:200})
  })
  const result=await createOllamaLocalInferenceTransport(gateway,fake as typeof fetch).generate({
   model:"qwen3:4b",system:"read only",prompt:"hello",maxOutputTokens:512,
  })
  expect(result.inputTokens).toBe(10)
  expect(sentUrl).toBe("https://private-owner.example/api/chat")
  expect(sentUrl).not.toContain(gateway.token)
  expect((sent?.headers as Record<string,string>).authorization).toBe("Bearer example-private-token")
  expect(sent?.redirect).toBe("error")
  const request=JSON.parse(sent?.body as string)
  expect(request).toMatchObject({stream:false,format:"json",model:"qwen3:4b"})
  expect(request.tools).toBeUndefined()
 })
 it("refuses model mismatch or upstream errors",async()=>{
  const remote=vi.fn(async()=>new Response("not ready",{status:503}))
  const t=createOllamaLocalInferenceTransport(local,remote as typeof fetch)
  await expect(t.generate({model:"other",system:"",prompt:"hi",maxOutputTokens:1024})).rejects.toThrow("NOT_ALLOWLISTED")
  expect(remote).not.toHaveBeenCalled()
  await expect(t.generate({model:"qwen3:4b",system:"",prompt:"hi",maxOutputTokens:1024})).rejects.toThrow("UNAVAILABLE")
 })
 it("rejects half-configured Cloudflare Access and attaches only server-side service credentials",async()=>{
  const clientId="test-access-id",clientSecret="test-access-secret"
  expect(()=>validateLocalModelEndpoint({...gateway,accessClientId:clientId})).toThrow(/ACCESS_CREDENTIAL_PAIR_REQUIRED/)
  expect(()=>validateLocalModelEndpoint({...gateway,accessClientSecret:clientSecret})).toThrow(/ACCESS_CREDENTIAL_PAIR_REQUIRED/)
  let headers:Record<string,string>|undefined
  const fake=vi.fn(async (_:RequestInfo|URL, init?:RequestInit)=>{
   headers=init?.headers as Record<string,string>
   return new Response(JSON.stringify({message:{content:"{\"disposition\":\"DEFER\"}"}}))
  })
  await createOllamaLocalInferenceTransport({...gateway,accessClientId:clientId,accessClientSecret:clientSecret},
   fake as typeof fetch).generate({model:gateway.model,system:"local",prompt:"hello",maxOutputTokens:512})
  expect(headers?.["CF-Access-Client-Id"]).toBe(clientId)
  expect(headers?.["CF-Access-Client-Secret"]).toBe(clientSecret)
  expect(headers?.authorization).toBe("Bearer example-private-token")
 })
 it("marks unconfigured local endpoint unavailable",()=>{
  expect(resolveLocalModelConnection({JHADINA_LOCAL_MODEL_URL:undefined,JHADINA_LOCAL_MODEL_NAME:"x"})).toBeNull()
 })
})
