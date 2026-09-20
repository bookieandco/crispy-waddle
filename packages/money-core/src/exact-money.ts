export type ExactDecimal = Readonly<{ coefficient: bigint; scale: number }>
export type MoneyAmount = Readonly<ExactDecimal & { currency: string }>

function pow10(n:number):bigint { if(!Number.isInteger(n)||n<0) throw new Error('MONEY_SCALE_INVALID'); return 10n ** BigInt(n) }
export function assertExactDecimal(v:ExactDecimal):void { if(typeof v.coefficient!=='bigint'||!Number.isInteger(v.scale)||v.scale<0) throw new Error('MONEY_DECIMAL_INVALID') }
export function normalizeDecimal(v:ExactDecimal):ExactDecimal { assertExactDecimal(v); let c=v.coefficient,s=v.scale; while(s>0&&c%10n===0n){c/=10n;s--} return Object.freeze({coefficient:c,scale:s}) }
export function rescale(v:ExactDecimal,scale:number):ExactDecimal { assertExactDecimal(v); if(!Number.isInteger(scale)||scale<0)throw new Error('MONEY_SCALE_INVALID'); if(scale<v.scale){const d=pow10(v.scale-scale);if(v.coefficient%d!==0n)throw new Error('MONEY_INEXACT_RESCALE');return Object.freeze({coefficient:v.coefficient/d,scale})} return Object.freeze({coefficient:v.coefficient*pow10(scale-v.scale),scale}) }
function aligned(a:ExactDecimal,b:ExactDecimal){const scale=Math.max(a.scale,b.scale);return [rescale(a,scale),rescale(b,scale),scale] as const}
export function addDecimal(a:ExactDecimal,b:ExactDecimal):ExactDecimal {const [x,y,s]=aligned(a,b);return normalizeDecimal({coefficient:x.coefficient+y.coefficient,scale:s})}
export function subtractDecimal(a:ExactDecimal,b:ExactDecimal):ExactDecimal {const [x,y,s]=aligned(a,b);return normalizeDecimal({coefficient:x.coefficient-y.coefficient,scale:s})}
export function multiplyDecimal(a:ExactDecimal,b:ExactDecimal):ExactDecimal {assertExactDecimal(a);assertExactDecimal(b);return normalizeDecimal({coefficient:a.coefficient*b.coefficient,scale:a.scale+b.scale})}
export function compareDecimal(a:ExactDecimal,b:ExactDecimal):number {const[x,y]=aligned(a,b);return x.coefficient<y.coefficient?-1:x.coefficient>y.coefficient?1:0}
export function money(coefficient:bigint,scale:number,currency:string):MoneyAmount {if(!currency.trim())throw new Error('MONEY_CURRENCY_REQUIRED');const n=normalizeDecimal({coefficient,scale});return Object.freeze({...n,currency:currency.toUpperCase()})}
function sameCurrency(a:MoneyAmount,b:MoneyAmount){if(a.currency!==b.currency)throw new Error('MONEY_CURRENCY_MISMATCH')}
export function addMoney(a:MoneyAmount,b:MoneyAmount):MoneyAmount {sameCurrency(a,b);const n=addDecimal(a,b);return money(n.coefficient,n.scale,a.currency)}
export function subtractMoney(a:MoneyAmount,b:MoneyAmount):MoneyAmount {sameCurrency(a,b);const n=subtractDecimal(a,b);return money(n.coefficient,n.scale,a.currency)}
export function compareMoney(a:MoneyAmount,b:MoneyAmount):number {sameCurrency(a,b);return compareDecimal(a,b)}
export function multiplyMoney(a:MoneyAmount,q:ExactDecimal):MoneyAmount {const n=multiplyDecimal(a,q);return money(n.coefficient,n.scale,a.currency)}
export function parseDecimal(text:string):ExactDecimal {if(!/^-?\d+(\.\d+)?$/.test(text))throw new Error('MONEY_DECIMAL_TEXT_INVALID');const neg=text.startsWith('-');const raw=neg?text.slice(1):text;const [w,f='']=raw.split('.');const c=BigInt(w+f)*(neg?-1n:1n);return normalizeDecimal({coefficient:c,scale:f.length})}
export function decimalToString(v:ExactDecimal):string {assertExactDecimal(v);const neg=v.coefficient<0n;const digits=(neg?-v.coefficient:v.coefficient).toString().padStart(v.scale+1,'0');const out=v.scale?digits.slice(0,-v.scale)+'.'+digits.slice(-v.scale):digits;return neg?'-'+out:out}
