"use client"

export type PhantomSolanaConnection=Readonly<{
 provider:"phantom"
 network:"SOLANA"
 address:string
 connected:true
 authority:"CLIENT_CONNECTION_ONLY"
 canMoveFunds:false
}>

type PublicKeyLike={toString():string}
type PhantomSolanaProvider={
 isPhantom?:boolean
 publicKey?:PublicKeyLike|null
 connect:(options?:{onlyIfTrusted?:boolean})=>Promise<{publicKey?:PublicKeyLike}>
 disconnect?:()=>Promise<void>
}
type PhantomWindow=Window&{phantom?:{solana?:PhantomSolanaProvider}}

export function getPhantomSolanaProvider():PhantomSolanaProvider|undefined{
 if(typeof window==="undefined")return undefined
 const provider=(window as PhantomWindow).phantom?.solana
 return provider?.isPhantom?provider:undefined
}

export async function connectPhantomSolana():Promise<PhantomSolanaConnection>{
 const provider=getPhantomSolanaProvider()
 if(!provider)throw new Error("MONEY_PHANTOM_NOT_INSTALLED")
 const result=await provider.connect()
 const address=result.publicKey?.toString()??provider.publicKey?.toString()
 if(!address)throw new Error("MONEY_PHANTOM_ADDRESS_UNAVAILABLE")
 return Object.freeze({provider:"phantom" as const,network:"SOLANA" as const,address,connected:true as const,authority:"CLIENT_CONNECTION_ONLY" as const,canMoveFunds:false as const})
}

export async function disconnectPhantomSolana():Promise<void>{
 const provider=getPhantomSolanaProvider()
 if(provider?.disconnect)await provider.disconnect()
}


export function phantomBrowseUrl(currentUrl?:string):string{
 const url=currentUrl??(typeof window!=="undefined"?window.location.href:"")
 if(!url)throw new Error("MONEY_PHANTOM_BROWSE_URL_REQUIRED")
 const parsed=new URL(url)
 if(parsed.protocol!=="https:"&&parsed.hostname!=="localhost"&&parsed.hostname!=="127.0.0.1")throw new Error("MONEY_PHANTOM_HTTPS_REQUIRED")
 const encoded=encodeURIComponent(parsed.toString())
 const ref=encodeURIComponent(parsed.origin)
 return `https://phantom.app/ul/browse/${encoded}?ref=${ref}`
}

export function openMoneyInPhantom(currentUrl?:string){
 if(typeof window==="undefined")throw new Error("MONEY_PHANTOM_BROWSER_REQUIRED")
 window.location.assign(phantomBrowseUrl(currentUrl))
}
