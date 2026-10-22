import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const WALLET = "Ecdudvb15AMFeE9B4KU9WqLQmGHzm57yUR9egZ5fG6Nq";
const FUNCTION = "jhadina-phantom-passwordless-claim";
const TTL_MS = 2 * 60 * 1000;
const b58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const spkiKeyLength = 32;

function permittedOrigin(input: string | null): string | null {
  if (!input) return null;
  try {
    const uri = new URL(input);
    if (uri.protocol !== "https:" || uri.username || uri.password || uri.pathname !== "/" || uri.search || uri.hash) return null;
    const h = uri.hostname;
    if (h === "crispy-waddle-jhadina-web-git-buil-3b8aed-bookieandcos-projects.vercel.app" ||
        /^crispy-waddle-jhadina-[a-z0-9]+-bookieandcos-projects\.vercel\.app$/.test(h)) return uri.origin;
  } catch { /* Reject unparseable origin */ }
  return null;
}
function headers(origin: string) {
  return {"content-type":"application/json","cache-control":"no-store",
    "access-control-allow-origin":origin,
    "access-control-allow-methods":"POST, OPTIONS",
    "access-control-allow-headers":"content-type",
    "vary":"Origin","x-content-type-options":"nosniff"};
}
function response(origin:string,status:number,data:Record<string,unknown>){
  return new Response(JSON.stringify(data),{status,headers:headers(origin)});
}
function pubkey(address: string): Uint8Array {
  if (!address || address.length > 44) throw new Error("INVALID_WALLET");
  let value=0n;
  for(const char of address){
    const x=b58.indexOf(char);
    if(x<0) throw new Error("INVALID_WALLET");
    value=value*58n+BigInt(x);
  }
  const bytes:number[]=[];
  while(value>0n){bytes.unshift(Number(value&255n));value>>=8n;}
  const leading=(address.match(/^1+/)?.[0].length||0);
  const result=new Uint8Array([...Array(leading).fill(0),...bytes]);
  if(result.length!==spkiKeyLength)throw new Error("INVALID_WALLET");
  return result;
}
function signatureBytes(data:unknown):Uint8Array{
  if(typeof data!=="string" || data.length>128 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))throw new Error("INVALID_SIGNATURE");
  const raw=atob(data);
  if(raw.length!==64||btoa(raw)!==data)throw new Error("INVALID_SIGNATURE");
  return Uint8Array.from(raw,ch=>ch.charCodeAt(0));
}
async function verifyWalletProof(message:string, signature:unknown):Promise<boolean>{
  if(!message || message.length>2048) return false;
  const key=await crypto.subtle.importKey("raw",pubkey(WALLET),{name:"Ed25519"},false,["verify"]);
  return await crypto.subtle.verify("Ed25519",key,signatureBytes(signature),new TextEncoder().encode(message));
}
function config(){
  const url=Deno.env.get("SUPABASE_URL");
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url || !key)throw new Error("PRIVATE_STORE_UNAVAILABLE");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function hex(bytes:Uint8Array){return [...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");}
Deno.serve(async(req:Request)=>{
  const origin=permittedOrigin(req.headers.get("origin"));
  if(!origin)return new Response("Forbidden",{status:403,headers:{"cache-control":"no-store"}});
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(origin)});
  if(req.method!=="POST")return response(origin,405,{success:false,error:"METHOD_NOT_ALLOWED"});
  if(Number(req.headers.get("content-length")||0)>4096)return response(origin,413,{success:false,error:"REQUEST_TOO_LARGE"});
  let body:Record<string,unknown>;
  try{
    const raw=await req.text();
    if(raw.length>4096)throw new Error("BODY_TOO_LARGE");
    body=JSON.parse(raw);
    if(!body || Array.isArray(body) || typeof body!=="object" || body.address!==WALLET) return response(origin,400,{success:false,error:"WALLET_MISMATCH"});
  }catch{return response(origin,400,{success:false,error:"INVALID_REQUEST"});}
  if(body.action!=="challenge"&&body.action!=="verify"&&body.action!=="status")return response(origin,400,{success:false,error:"INVALID_ACTION"});
  try{
    const db=config();
    const {data:owners,error:ownerError}=await db.from("jhadina_wallets")
      .select("owner_id,ownership_verified,observation_enabled,trading_enabled")
      .eq("address",WALLET).eq("chain","solana").eq("provider","phantom").limit(2);
    if(ownerError||!owners||owners.length!==1)throw new Error("OWNER_WALLET_NOT_PREAPPROVED");
    const wallet=owners[0];
    // The public route never grants a Jhadina session, wallet signer lease,
    // execution permit, transfer or trading authority.
    if(body.action==="status"){
      return response(origin,200,{success:true,data:{address:WALLET,verified:wallet.ownership_verified===true&&wallet.observation_enabled===true,canSign:false,canTrade:false}});
    }
    if(body.action==="challenge"){
      const since=new Date(Date.now()-60_000).toISOString();
      const {data:recent,error:recentError}=await db.from("jhadina_wallet_challenges").select("challenge_id")
        .eq("owner_id",wallet.owner_id).eq("wallet_address",WALLET).gte("created_at",since).limit(4);
      if(recentError)throw new Error("RATE_CHECK_UNAVAILABLE");
      if((recent?.length||0)>=3)return response(origin,429,{success:false,error:"TOO_MANY_CHALLENGES"});
      const issued=new Date();
      const expires=new Date(issued.getTime()+TTL_MS);
      const nonce=hex(crypto.getRandomValues(new Uint8Array(32)));
      const challengeId=crypto.randomUUID();
      const message=[
        "Jhadina owner wallet activation — observation only",
        "Domain: "+origin,
        "Network: Solana mainnet",
        "Wallet: "+WALLET,
        "Nonce: "+nonce,
        "Issued at: "+issued.toISOString(),
        "Expires at: "+expires.toISOString(),
        "Purpose: connect the preapproved wallet for read-only observation.",
        "This message cannot sign transactions or authorize trading."
      ].join("\n");
      const {error:stored}=await db.from("jhadina_wallet_challenges").insert({
        challenge_id:challengeId,owner_id:wallet.owner_id,wallet_address:WALLET,
        chain:"solana",provider:"phantom",nonce,message,expires_at:expires.toISOString()
      });
      if(stored)throw new Error("CHALLENGE_STORE_FAILED");
      return response(origin,200,{success:true,data:{challengeId,message,expiresAt:expires.toISOString(),canSign:false,canTrade:false}});
    }
    if(typeof body.challengeId!=="string"||
       !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.challengeId)){
      return response(origin,400,{success:false,error:"INVALID_CHALLENGE"});
    }
    const {data:challenge,error:readError}=await db.from("jhadina_wallet_challenges")
      .select("challenge_id,owner_id,wallet_address,chain,provider,message,expires_at,consumed_at")
      .eq("challenge_id",body.challengeId).eq("owner_id",wallet.owner_id)
      .eq("wallet_address",WALLET).maybeSingle();
    if(readError||!challenge||challenge.chain!=="solana"||challenge.provider!=="phantom"||
      challenge.consumed_at || Date.parse(challenge.expires_at)<=Date.now() ||
      !challenge.message.includes("Domain: "+origin+"\n")){
      return response(origin,400,{success:false,error:"CHALLENGE_EXPIRED_OR_INVALID"});
    }
    if(!await verifyWalletProof(challenge.message,body.signatureBase64)){
      return response(origin,400,{success:false,error:"PHANTOM_SIGNATURE_INVALID"});
    }
    const now=new Date().toISOString();
    const {data:claimed,error:claimError}=await db.from("jhadina_wallet_challenges")
      .update({consumed_at:now}).eq("challenge_id",body.challengeId)
      .eq("owner_id",wallet.owner_id).is("consumed_at",null).gt("expires_at",now)
      .select("challenge_id");
    if(claimError||claimed?.length!==1)return response(origin,400,{success:false,error:"CHALLENGE_ALREADY_USED"});
    const {error:walletError}=await db.from("jhadina_wallets").update({
      ownership_verified:true,ownership_verified_at:now,observation_enabled:true,
      trading_enabled:false,updated_at:now
    }).eq("owner_id",wallet.owner_id).eq("address",WALLET).eq("chain","solana");
    if(walletError)throw new Error("WALLET_ACTIVATION_FAILED");
    const {data:existing,error:connectionError}=await db.from("money_wallet_connections")
      .select("connection_id").eq("user_id",wallet.owner_id).eq("address",WALLET)
      .eq("network","SOLANA").eq("provider","phantom").maybeSingle();
    if(connectionError)throw new Error("CONNECTION_LOOKUP_FAILED");
    const {error:storeError}=await db.from("money_wallet_connections").upsert({
      connection_id:existing?.connection_id||crypto.randomUUID(),user_id:wallet.owner_id,
      provider:"phantom",network:"SOLANA",address:WALLET,mode:"OWNER_WALLET",
      status:"ACTIVE",evidence_ids:["phantom:ed25519-challenge:"+body.challengeId],
      connected_at:now,updated_at:now
    },{onConflict:"user_id,provider,network,address"});
    if(storeError)throw new Error("CONNECTION_STORE_FAILED");
    return response(origin,200,{success:true,data:{address:WALLET,verified:true,mode:"OWNER_WALLET",canSign:false,canTrade:false}});
  }catch{
    return response(origin,503,{success:false,error:"WALLET_ACTIVATION_UNAVAILABLE"});
  }
});
