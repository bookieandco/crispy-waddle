import type { SamSearchParams } from './sam-client'

const DATE=/^\d{2}\/\d{2}\/\d{4}$/
const TOKEN=/^[A-Za-z0-9 _()&.,\/-]{1,80}$/

function int(value:string|null, fallback:number, min:number, max:number, name:string):number{
  if(value===null)return fallback
  const n=Number(value)
  if(!Number.isInteger(n)||n<min||n>max)throw new Error(`Invalid ${name}`)
  return n
}
function optional(value:string|null,name:string,max=200):string|undefined{
  if(value===null)return undefined
  const v=value.trim()
  if(!v)return undefined
  if(v.length>max)throw new Error(`${name} is too long`)
  return v
}
export function parseSamRouteSearch(search:URLSearchParams):SamSearchParams{
  const allowed=new Set(['limit','offset','postedFrom','postedTo','keyword','noticeType','typeOfSetAside'])
  for(const key of search.keys())if(!allowed.has(key))throw new Error(`Unsupported SAM search parameter: ${key}`)
  const postedFrom=optional(search.get('postedFrom'),'postedFrom',10)
  const postedTo=optional(search.get('postedTo'),'postedTo',10)
  const noticeType=optional(search.get('noticeType'),'noticeType',80)
  const typeOfSetAside=optional(search.get('typeOfSetAside'),'typeOfSetAside',80)
  if(postedFrom&&!DATE.test(postedFrom))throw new Error('postedFrom must use MM/DD/YYYY')
  if(postedTo&&!DATE.test(postedTo))throw new Error('postedTo must use MM/DD/YYYY')
  if(noticeType&&!TOKEN.test(noticeType))throw new Error('Invalid noticeType')
  if(typeOfSetAside&&!TOKEN.test(typeOfSetAside))throw new Error('Invalid typeOfSetAside')
  return {
    limit:int(search.get('limit'),25,1,100,'limit'),
    offset:int(search.get('offset'),0,0,100000,'offset'),
    postedFrom,postedTo,
    keyword:optional(search.get('keyword'),'keyword',200),
    noticeType,typeOfSetAside,
  }
}
