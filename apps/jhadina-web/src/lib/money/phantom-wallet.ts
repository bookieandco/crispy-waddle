"use client"

export type PhantomSolanaConnection=Readonly<{
 provider:'phantom'
 network:'SOLANA'
 address:string
 connected:true
 authority:'CLIENT_CONNECTION_ONLY'
 canMoveFunds:false
}>

type PublicKeyLike={toString():string}
type PhantomSolanaProvider={
 isPhantom?:boolean
 isConnected?:boolean
 publicKey?:PublicKeyLike|null
 connect:(options?:{onlyIfTrusted?:boolean})=>Promise<{publicKey?:PublicKeyLike}>
 disconnect?:()=>Promise<void>
 signMessage?:(message:Uint8Array,display?:'utf8'|'hex')=>Promise<{signature:Uint8Array;publicKey?:PublicKeyLike}>
 on?:(name:'connect'|'disconnect'|'accountChanged',callback:(...args:unknown[])=>void)=>void
 removeListener?:(name:'connect'|'disconnect'|'accountChanged',callback:(...args:unknown[])=>void)=>void
}
type PhantomWindow=Window&{phantom?:{solana?:PhantomSolanaProvider};solana?:PhantomSolanaProvider}

export function getPhantomSolanaProvider():PhantomSolanaProvider|undefined{
 if(typeof window==='undefined')return undefined
 const w=window as PhantomWindow
 const provider=w.phantom?.solana??w.solana
 return provider?.isPhantom?provider:undefined
}
export function currentPhantomSolanaAddress():string|undefined{
 const key=getPhantomSolanaProvider()?.publicKey?.toString()
 return key||undefined
}
export async function trustedPhantomSolanaAddress():Promise<string|undefined>{
 const provider=getPhantomSolanaProvider()
 if(!provider)return undefined
 try{
  const connected=await provider.connect({onlyIfTrusted:true})
  return connected.publicKey?.toString()??provider.publicKey?.toString()??undefined
 }catch{return undefined}
}
export async function connectPhantomSolana():Promise<PhantomSolanaConnection>{
 const provider=getPhantomSolanaProvider()
 if(!provider)throw new Error('MONEY_PHANTOM_NOT_INSTALLED')
 const result=await provider.connect()
 const address=result.publicKey?.toString()??provider.publicKey?.toString()
 if(!address)throw new Error('MONEY_PHANTOM_ADDRESS_UNAVAILABLE')
 return Object.freeze({provider:'phantom',network:'SOLANA',address,connected:true,
  authority:'CLIENT_CONNECTION_ONLY',canMoveFunds:false})
}
export async function signPhantomOwnershipMessage(message:string,address:string):Promise<string>{
 const provider=getPhantomSolanaProvider()
 if(!provider?.signMessage)throw new Error('MONEY_PHANTOM_MESSAGE_SIGNING_UNAVAILABLE')
 if(provider.publicKey?.toString()!==address)throw new Error('MONEY_PHANTOM_ACCOUNT_CHANGED')
 const bytes=new TextEncoder().encode(message)
 const result=await provider.signMessage(bytes,'utf8')
 if(provider.publicKey?.toString()!==address||result.publicKey?.toString()&&result.publicKey.toString()!==address){
  throw new Error('MONEY_PHANTOM_ACCOUNT_CHANGED')
 }
 if(!(result.signature instanceof Uint8Array)||result.signature.length!==64)throw new Error('MONEY_PHANTOM_SIGNATURE_INVALID')
 return btoa(String.fromCharCode(...result.signature))
}
export async function disconnectPhantomSolana():Promise<void>{
 const provider=getPhantomSolanaProvider()
 if(provider?.disconnect)await provider.disconnect()
}
export function phantomBrowseUrl(currentUrl?:string):string{
 const url=currentUrl??(typeof window!=='undefined'?window.location.href:'')
 if(!url)throw new Error('MONEY_PHANTOM_BROWSE_URL_REQUIRED')
 const parsed=new URL(url)
 if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new Error('MONEY_PHANTOM_PUBLIC_HTTPS_REQUIRED')
 const encoded=encodeURIComponent(parsed.toString())
 const ref=encodeURIComponent(parsed.origin)
 return `https://phantom.app/ul/browse/${encoded}?ref=${ref}`
}
export function openMoneyInPhantom(currentUrl?:string){
 if(typeof window==='undefined')throw new Error('MONEY_PHANTOM_BROWSER_REQUIRED')
 window.location.assign(phantomBrowseUrl(currentUrl))
}
