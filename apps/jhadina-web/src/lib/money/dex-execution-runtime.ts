import "server-only"
import {
 bindUniversalSolanaDexRuntime,
 RemoteCofferSignerAdapter,
 SolanaRpcHttpObserver,
 type DexRouterRuntimeBinding,
} from "@jhadina/money-core"

function required(name:string):string{
 const value=process.env[name]?.trim()
 if(!value)throw new Error("DEX_RUNTIME_"+name+"_REQUIRED")
 return value
}
function https(name:string):string{
 const value=required(name)
 if(!value.startsWith("https://"))throw new Error("DEX_RUNTIME_"+name+"_HTTPS_REQUIRED")
 return value
}
function digits(name:string):string{
 const value=required(name)
 if(!/^\d+$/.test(value))throw new Error("DEX_RUNTIME_"+name+"_INTEGER_REQUIRED")
 return value
}

export type ServerDexExecutionRuntime=Readonly<{
 router:DexRouterRuntimeBinding
 signer:RemoteCofferSignerAdapter
 chain:SolanaRpcHttpObserver
 authority:"SERVER_RUNTIME_ONLY"
 exposesSecrets:false
}>

export function createServerDexExecutionRuntime():ServerDexExecutionRuntime{
 const rpc=https("SOLANA_RPC_URL")
 const jupiterApiKey=required("JUPITER_API_KEY")
 const signerUrl=https("MONEY_DEX_COFFER_SIGNER_URL")
 const signerAuth=required("MONEY_DEX_COFFER_SIGNER_AUTH")
 const meteoraUrl=https("MONEY_METEORA_BUILDER_URL")
 const meteoraAuth=required("MONEY_METEORA_BUILDER_AUTH")
 const priorityFee=digits("MONEY_RAYDIUM_PRIORITY_FEE_MICRO_LAMPORTS")
 const resolveRpcEndpoint=()=>rpc
 return Object.freeze({
  router:bindUniversalSolanaDexRuntime({
   resolveSolanaRpcEndpoint:resolveRpcEndpoint,
   resolveJupiterApiKey:()=>jupiterApiKey,
   raydiumComputeUnitPriceMicroLamports:priorityFee,
   meteoraBuilderBaseUrl:meteoraUrl,
   resolveMeteoraBuilderAuthorization:()=>meteoraAuth,
  }),
  signer:new RemoteCofferSignerAdapter({baseUrl:signerUrl,resolveAuthorizationHeader:()=>signerAuth}),
  chain:new SolanaRpcHttpObserver({resolveRpcEndpoint}),
  authority:"SERVER_RUNTIME_ONLY" as const,
  exposesSecrets:false as const,
 })
}
