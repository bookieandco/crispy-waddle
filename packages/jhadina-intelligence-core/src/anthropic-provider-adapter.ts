import type { ContextPacket } from '@jhadina/core-spine';
import { parseDecisionProposal } from './proposal-validation.js';
import type { ProviderAdapter, ProviderNativeResult } from './provider-adapter.js';
import type { ModelRegistryEntry } from './model-registry.js';

export class AnthropicProviderAdapter implements ProviderAdapter {
 readonly provider='anthropic';
 constructor(private readonly options:{apiKey?:string;fetchImpl?:typeof fetch;baseUrl?:string}={}){}
 async invoke(input:{model:ModelRegistryEntry;context:ContextPacket}):Promise<ProviderNativeResult>{
  const apiKey=this.options.apiKey??process.env.ANTHROPIC_API_KEY;
  if(!apiKey) throw new Error('CREDENTIAL_NOT_CONFIGURED:intelligence/anthropic');
  if(input.model.provider!==this.provider||input.model.lifecycle!=='active') throw new Error('ANTHROPIC_PROVIDER_MODEL_NOT_ROUTABLE');
  const response=await (this.options.fetchImpl??fetch)(`${this.options.baseUrl??'https://api.anthropic.com'}/v1/messages`,{method:'POST',headers:{'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:input.model.providerModelId,max_tokens:Math.min(1024,input.model.maxOutputTokens),system:'You are a replaceable Jhadina reasoning component, not authority. Return one DecisionProposal JSON object. Cite only evidence IDs supplied in context. Never approve, execute, grant capabilities, override policy, or write durable memory.',messages:[{role:'user',content:JSON.stringify(input.context)}]})});
  if(!response.ok) throw new Error(`ANTHROPIC_PROVIDER_REQUEST_FAILED:${response.status}`);
  const body=await response.json() as {content?:Array<{text?:string}>;usage?:{input_tokens?:number;output_tokens?:number};id?:string};
  const text=body.content?.[0]?.text;if(typeof text!=='string') throw new Error('ANTHROPIC_PROVIDER_MALFORMED_RESPONSE');
  return {proposal:parseDecisionProposal(text,input.context.id),usage:{inputTokens:body.usage?.input_tokens,outputTokens:body.usage?.output_tokens},providerRequestId:body.id};
 }
}
