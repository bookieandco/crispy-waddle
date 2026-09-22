const SUBNET_BASE='https://legacy.sba.gov'
export const SUBNET_LIST_URL=SUBNET_BASE+'/federal-contracting/contracting-guide/prime-subcontracting/subcontracting-opportunities'

export type SubnetListingRecord={
  externalId:string
  title:string
  primeName:string
  description?:string
  closingDate?:string
  performanceStartDate?:string
  placeOfPerformance?:string
  naicsCode?:string
  naicsLabel?:string
  contactName?:string
  contactEmail?:string
  contactPhone?:string
  sourceUrl:string
  sourcePage:number
  rawText:string
}

function decodeHtml(value:string){
  const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}
  return value
    .replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(Number.parseInt(hex,16)))
    .replace(/&#([0-9]+);/g,(_,dec)=>String.fromCodePoint(Number.parseInt(dec,10)))
    .replace(/&([a-z]+);/gi,(all,name)=>named[name.toLowerCase()]??all)
}

function textLines(html:string){
  const text=decodeHtml(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi,' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
      .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/td|\/th)\b[^>]*>/gi,'\n')
      .replace(/<[^>]+>/g,' '),
  )
  return text
    .split(/\r?\n/)
    .map(line=>line.replace(/\s+/g,' ').replace(/^[•*\-]+\s*/,'').trim())
    .filter(Boolean)
}

function isoDate(value?:string){
  const match=value?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if(!match)return undefined
  const month=match[1],day=match[2],year=match[3]
  return year+'-'+month.padStart(2,'0')+'-'+day.padStart(2,'0')
}

function field(lines:string[],label:string){
  const index=lines.findIndex(line=>line.toLowerCase()===label.toLowerCase())
  if(index<0)return undefined
  return lines[index+1]
}

function contact(lines:string[]){
  const index=lines.findIndex(line=>line.toLowerCase()==='point of contact')
  if(index<0)return{}
  const values=lines.slice(index+1,Math.min(lines.length,index+7))
  const email=values.find(value=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))
  const phone=values.find(value=>/\d{3}[-.)\s]\d{3}[-\s]\d{4}/.test(value))
  const name=values.find(value=>value!==email&&value!==phone&&!/^(pagination|previous|next|page \d+)$/i.test(value))
  return {contactName:name,contactEmail:email,contactPhone:phone}
}

export function parseSubnetListingPage(html:string,sourcePage=0):SubnetListingRecord[]{
  const anchor=/<a\b[^>]*href=(["'])([^"']*\/opportunity\/[^"']+)\1[^>]*>([\s\S]*?)<\/a>/gi
  const matches=[...html.matchAll(anchor)]
  const out=new Map<string,SubnetListingRecord>()

  for(let index=0;index<matches.length;index+=1){
    const match=matches[index]
    const href=decodeHtml(match[2]??'')
    const title=textLines(match[3]??'').join(' ').trim()
    const segmentStart=(match.index??0)+match[0].length
    const segmentEnd=index+1<matches.length?(matches[index+1].index??html.length):html.length
    const segment=html.slice(segmentStart,segmentEnd)
    if(!/Closing Date/i.test(segment)||!/Point of Contact/i.test(segment))continue

    const lines=textLines(segment)
    const closingIndex=lines.findIndex(line=>line.toLowerCase()==='closing date')
    if(closingIndex<=0||!title)continue
    const primeName=lines[0]
    const descriptionLines=lines.slice(1,closingIndex).filter(line=>line.toLowerCase()!=='description')
    const naicsValue=field(lines,'NAICS code')
    const naicsMatch=naicsValue?.match(/\b(\d{6})\b(?:\s*:\s*(.*))?/)
    const slugMatch=href.match(/\/opportunity\/([^?#/]+)/i)
    const externalId=slugMatch?.[1]??href.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
    if(!externalId||!primeName)continue
    const sourceUrl=new URL(href,SUBNET_BASE).toString()

    const closingDate=isoDate(field(lines,'Closing Date'))
    const performanceStartDate=isoDate(field(lines,'Performance Start Date'))
    const placeOfPerformance=field(lines,'Place of Performance')
    out.set(externalId,{
      externalId,
      title,
      primeName,
      ...(descriptionLines.length?{description:descriptionLines.join(' ')}:{}),
      ...(closingDate?{closingDate}:{}),
      ...(performanceStartDate?{performanceStartDate}:{}),
      ...(placeOfPerformance?{placeOfPerformance}:{}),
      ...(naicsMatch?.[1]?{naicsCode:naicsMatch[1]}:{}),
      ...(naicsMatch?.[2]?{naicsLabel:naicsMatch[2].trim()}:{}),
      ...contact(lines),
      sourceUrl,
      sourcePage,
      rawText:lines.join('\n'),
    })
  }
  return [...out.values()]
}

export async function scanSubnetListings(input:{maxPages?:number;state?:string}={}){
  const maxPages=Math.max(1,Math.min(Math.floor(input.maxPages??20),50))
  const state=input.state?.trim()||'All'
  const records=new Map<string,SubnetListingRecord>()
  let pages=0
  let truncated=false

  for(let page=0;page<maxPages;page+=1){
    const url=new URL(SUBNET_LIST_URL)
    url.searchParams.set('page',String(page))
    url.searchParams.set('state',state)
    const response=await fetch(url,{
      headers:{
        accept:'text/html,application/xhtml+xml',
        'user-agent':'Jhadina Opportunity Core/1.0; public SBA SUBNet ingestion; no automated outreach',
      },
      cache:'no-store',
      signal:AbortSignal.timeout(30000),
    })
    if(!response.ok)throw new Error('SBA_SUBNET_HTTP_'+response.status)
    const html=await response.text()
    const pageRecords=parseSubnetListingPage(html,page)
    pages+=1
    if(pageRecords.length===0)break
    let added=0
    for(const record of pageRecords){
      if(!records.has(record.externalId))added+=1
      records.set(record.externalId,record)
    }
    if(added===0)break
    if(page===maxPages-1)truncated=true
    if(page<maxPages-1)await new Promise(resolve=>setTimeout(resolve,250))
  }

  return {pages,records:[...records.values()],truncated}
}
