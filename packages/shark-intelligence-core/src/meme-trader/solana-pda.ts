const BASE58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const PDA_MARKER=new TextEncoder().encode('ProgramDerivedAddress')
const ED_P=(1n<<255n)-19n

const mod=(value:bigint)=>{const r=value%ED_P;return r<0n?r+ED_P:r}
const powMod=(base:bigint,exp:bigint)=>{
  let b=mod(base),e=exp,out=1n
  while(e>0n){if(e&1n)out=mod(out*b);b=mod(b*b);e>>=1n}
  return out
}
const inv=(value:bigint)=>powMod(value,ED_P-2n)
const ED_D=mod(-121665n*inv(121666n))
const ED_I=powMod(2n,(ED_P-1n)/4n)

export function decodeBase58(value:string):Uint8Array{
  const text=value.trim()
  if(!text)throw new Error('solana_base58_empty')
  const bytes=[0]
  for(const char of text){
    const digit=BASE58.indexOf(char)
    if(digit<0)throw new Error('solana_base58_invalid')
    let carry=digit
    for(let i=0;i<bytes.length;i++){
      const n=bytes[i]!*58+carry
      bytes[i]=n&255
      carry=n>>8
    }
    while(carry){bytes.push(carry&255);carry>>=8}
  }
  let leading=0
  while(leading<text.length-1&&text[leading]==='1')leading++
  const out=new Uint8Array(leading+bytes.length)
  for(let i=0;i<bytes.length;i++)out[out.length-1-i]=bytes[i]!
  return out
}

export function encodeBase58(bytes:Uint8Array):string{
  if(!bytes.length)return ''
  if(bytes.every(byte=>byte===0))return '1'.repeat(bytes.length)
  const digits=[0]
  for(const byte of bytes){
    let carry=byte
    for(let i=0;i<digits.length;i++){const n=digits[i]!*256+carry;digits[i]=n%58;carry=Math.floor(n/58)}
    while(carry){digits.push(carry%58);carry=Math.floor(carry/58)}
  }
  let out=''
  for(const byte of bytes){if(byte===0)out+='1';else break}
  for(let i=digits.length-1;i>=0;i--)out+=BASE58[digits[i]!]!
  return out
}

const littleEndianBigInt=(bytes:Uint8Array)=>{
  let value=0n
  for(let i=bytes.length-1;i>=0;i--)value=(value<<8n)|BigInt(bytes[i]!)
  return value
}

/** Returns true only for a valid compressed Ed25519 point. */
export function isEd25519Point(bytes:Uint8Array):boolean{
  if(bytes.length!==32)return false
  const encoded=Uint8Array.from(bytes)
  const sign=encoded[31]!>>7
  encoded[31]=encoded[31]!&0x7f
  const y=littleEndianBigInt(encoded)
  if(y>=ED_P)return false
  const y2=mod(y*y)
  const denominator=mod(ED_D*y2+1n)
  if(denominator===0n)return false
  const x2=mod((y2-1n)*inv(denominator))
  let x=powMod(x2,(ED_P+3n)/8n)
  if(mod(x*x)!==x2)x=mod(x*ED_I)
  if(mod(x*x)!==x2)return false
  if(x===0n&&sign===1)return false
  return true
}

const concat=(parts:readonly Uint8Array[])=>{
  const total=parts.reduce((n,p)=>n+p.length,0)
  const out=new Uint8Array(total)
  let offset=0
  for(const part of parts){out.set(part,offset);offset+=part.length}
  return out
}

async function sha256(data:Uint8Array):Promise<Uint8Array>{
  const subtle=globalThis.crypto?.subtle
  if(!subtle)throw new Error('solana_pda_sha256_unavailable')
  const copy=new Uint8Array(data.length)
  copy.set(data)
  return new Uint8Array(await subtle.digest('SHA-256',copy.buffer))
}

export async function createSolanaProgramAddress(
  seeds:readonly Uint8Array[],
  programId:string,
):Promise<string>{
  if(seeds.length>16||seeds.some(seed=>seed.length>32))throw new Error('solana_pda_seed_invalid')
  const program=decodeBase58(programId)
  if(program.length!==32)throw new Error('solana_pda_program_id_invalid')
  const hash=await sha256(concat([...seeds,program,PDA_MARKER]))
  if(isEd25519Point(hash))throw new Error('solana_pda_on_curve')
  return encodeBase58(hash)
}

export async function findSolanaProgramAddress(
  seeds:readonly Uint8Array[],
  programId:string,
):Promise<Readonly<{address:string;bump:number}>>{
  for(let bump=255;bump>=0;bump--){
    try{
      const address=await createSolanaProgramAddress([...seeds,Uint8Array.of(bump)],programId)
      return Object.freeze({address,bump})
    }catch(error){
      if(error instanceof Error&&error.message==='solana_pda_on_curve')continue
      throw error
    }
  }
  throw new Error('solana_pda_bump_not_found')
}
