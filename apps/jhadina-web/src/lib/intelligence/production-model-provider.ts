import {
 AnthropicModelProvider,GeminiModelProvider,IntelligenceRouter,
 LocalModelProviderAdapter,ModelRegistry,RegistryBackedModelProvider,localModelEntry,
 type ModelProvider,type ModelRegistryEntry,type IntelligenceRouterEvent,
} from "@jhadina/intelligence-core"
import {LegacyClassifierProvider} from "./legacy-classifier-provider"
import {GovernedJllmModelRouter} from "./governed-model-routing"
import {createOllamaLocalInferenceTransport,resolveLocalModelConnection,validateLocalModelEndpoint} from "./ollama-local-transport"

export type JllmModelSelection="local"|"anthropic"|"gemini"
const isCloud=(v:string|undefined):v is "anthropic"|"gemini"=>v==="anthropic"||v==="gemini"

/** The free/local model is the default. Selecting billable clouds is explicit.
 * A key's mere presence NEVER authorizes a paid fallback.
 */
export function configuredJllmSelection(env?:{JHADINA_REASONING_PROVIDER?:string}):JllmModelSelection{
 const choice=env===undefined?process.env.JHADINA_REASONING_PROVIDER:env.JHADINA_REASONING_PROVIDER
 return isCloud(choice)?choice:"local"
}

export function createProductionIntelligenceRouter(
 onEvent?:(event:IntelligenceRouterEvent)=>void,
):IntelligenceRouter{
 const selected=configuredJllmSelection()
 const bindings:{model:ModelRegistryEntry;provider:ModelProvider}[]=[]
 if(selected==="local"){
  const connection=resolveLocalModelConnection()
  if(connection){
   try{
    validateLocalModelEndpoint(connection)
    const model=localModelEntry({id:"local.jllm.reasoning",providerModelId:connection.model,
     version:1,contextWindowTokens:16_384,maxOutputTokens:2048,enabled:true})
    const registry=new ModelRegistry({version:1,models:[model]})
    bindings.push({model,provider:new RegistryBackedModelProvider({
     modelId:model.id,registry,adapter:new LocalModelProviderAdapter(createOllamaLocalInferenceTransport(connection)),
    })})
   }catch{
    // Invalid or unsafe gateway is not an invitation to try paid services.
   }
  }
 }else{
  const key=(selected==="gemini"?process.env.GEMINI_API_KEY:process.env.ANTHROPIC_API_KEY)?.trim()
  if(key){
   const model:ModelRegistryEntry=selected==="gemini"?
    {id:"gemini.reasoning.owner",provider:"gemini",providerModelId:"gemini-2.5-flash-lite",
     modalities:["text","vision"],capabilities:["reason","summarize","classify","extract","plan","critique","verify"],
     maxPrivacyClass:"sensitive",contextWindowTokens:32_000,maxOutputTokens:1200,
     costClass:"low",latencyClass:"fast",lifecycle:"active",local:false,version:1}:
    {id:"anthropic.reasoning.owner",provider:"anthropic",providerModelId:"claude-sonnet-4-5-20250929",
     modalities:["text","vision"],capabilities:["reason","summarize","classify","extract","plan","critique","verify"],
     maxPrivacyClass:"sensitive",contextWindowTokens:32_000,maxOutputTokens:4096,
     costClass:"medium",latencyClass:"standard",lifecycle:"active",local:false,version:1}
   bindings.push({model,provider:selected==="gemini"?new GeminiModelProvider():new AnthropicModelProvider()})
  }
 }
 return new IntelligenceRouter({
  primary:new GovernedJllmModelRouter(bindings,selected==="local"?"restricted":"sensitive"),
  fallback:new LegacyClassifierProvider(),onEvent,
 })
}

export type JllmReasoningReadiness=Readonly<{
 selected:JllmModelSelection
 status:"CONFIGURED_UNVERIFIED"|"NOT_CONFIGURED"
 alternativeAvailable:"anthropic"|"gemini"|null
 fallback:"legacy-classifier"
 generalReasoningReady:false
 note:string
}>
export function readJllmReasoningReadiness(env?:Partial<Record<
 "JHADINA_REASONING_PROVIDER"|"ANTHROPIC_API_KEY"|"GEMINI_API_KEY"|
 "JHADINA_LOCAL_MODEL_URL"|"JHADINA_LOCAL_MODEL_NAME"|"JHADINA_LOCAL_MODEL_ALLOWED_HOST"|
 "JHADINA_LOCAL_MODEL_GATEWAY_TOKEN"|"NODE_ENV",string|undefined
>>):JllmReasoningReadiness{
 const config=env??{
  JHADINA_REASONING_PROVIDER:process.env.JHADINA_REASONING_PROVIDER,
  ANTHROPIC_API_KEY:process.env.ANTHROPIC_API_KEY,GEMINI_API_KEY:process.env.GEMINI_API_KEY,
  JHADINA_LOCAL_MODEL_URL:process.env.JHADINA_LOCAL_MODEL_URL,
  JHADINA_LOCAL_MODEL_NAME:process.env.JHADINA_LOCAL_MODEL_NAME,
  JHADINA_LOCAL_MODEL_ALLOWED_HOST:process.env.JHADINA_LOCAL_MODEL_ALLOWED_HOST,
  JHADINA_LOCAL_MODEL_GATEWAY_TOKEN:process.env.JHADINA_LOCAL_MODEL_GATEWAY_TOKEN,
  NODE_ENV:process.env.NODE_ENV,
 }
 const selected=configuredJllmSelection(config)
 let configured=false
 if(selected==="local"){
  const connection=resolveLocalModelConnection(config)
  if(connection){try{validateLocalModelEndpoint(connection);configured=true}catch{}}
 }else configured=Boolean((selected==="gemini"?config.GEMINI_API_KEY:config.ANTHROPIC_API_KEY)?.trim())
 return {
  selected,status:configured?"CONFIGURED_UNVERIFIED":"NOT_CONFIGURED",
  alternativeAvailable:selected==="local"
   ?(config.GEMINI_API_KEY?.trim()?"gemini":config.ANTHROPIC_API_KEY?.trim()?"anthropic":null)
   :null,
  fallback:"legacy-classifier",generalReasoningReady:false,
  note:configured
   ?"The selected provider is configured but no successful live answer is certified by this read-only check."
   :"The selected provider is not safely configured. JLLM can only return a classifier-only limitation until a trusted model endpoint is commissioned.",
 }
}

/** This receipt is not an external source citation or claim of fact verification. */
export type JllmReasoningReceipt=Readonly<{
 provider:JllmModelSelection|"legacy-classifier"
 mode:"MODEL_RESPONSE"|"CLASSIFICATION_ONLY"
 externallyVerified:false
 note:string
}>
export function resolveJllmReasoningReceipt(
 selected:JllmModelSelection,stages:readonly IntelligenceRouterEvent["stage"][],
):JllmReasoningReceipt{
 if(stages.includes("fallback_used"))return {
  provider:"legacy-classifier",mode:"CLASSIFICATION_ONLY",externallyVerified:false,
  note:"The selected model did not answer; a non-generative classifier returned the limitation.",
 }
 return {provider:selected,mode:"MODEL_RESPONSE",externallyVerified:false,
  note:"The selected model returned an answer; external facts still need independently verified sources."}
}
