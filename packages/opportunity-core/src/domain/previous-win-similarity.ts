export type PreviousWinFingerprint = {
  id: string
  providerId: string
  providerName: string
  uei?: string
  cage?: string
  naicsCodes: string[]
  pscCodes: string[]
  agency?: string
  state?: string
  awardAmount?: number
  evidenceRefs: string[]
}

export type PreviousWinSimilarityInput = {
  providerId: string
  providerName: string
  uei?: string
  cage?: string
  naicsCodes: string[]
  pscCodes: string[]
  state?: string
  keywords?: string[]
}

export type PreviousWinSimilarity = {
  score: number
  anchorProviderIds: string[]
  reasons: string[]
  evidenceRefs: string[]
}

const unique=(values:string[])=>[...new Set(values.map(v=>v.trim()).filter(Boolean))]
const normalized=(value?:string)=>value?.trim().toUpperCase().replace(/[^A-Z0-9]/g,'')??''
const normalizeName=(value:string)=>value.toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9 ]/g,' ').replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|co|company)\b/g,' ').replace(/\s+/g,' ').trim()
const overlap=(a:string[],b:string[])=>{
  const right=new Set(b.map(x=>x.trim().toUpperCase()).filter(Boolean))
  return unique(a).some(x=>right.has(x.toUpperCase()))
}
const pscFromKeywords=(keywords:string[]|undefined)=>unique((keywords??[]).flatMap(value=>{
  const m=/\bPSC\s+([A-Z0-9]{4})\b/i.exec(value)
  return m?[m[1]!.toUpperCase()]:[]
}))

function sameIdentity(candidate:PreviousWinSimilarityInput,anchor:PreviousWinFingerprint){
  if(candidate.uei&&anchor.uei&&normalized(candidate.uei)===normalized(anchor.uei))return true
  if(candidate.cage&&anchor.cage&&normalized(candidate.cage)===normalized(anchor.cage))return true
  return normalizeName(candidate.providerName)===normalizeName(anchor.providerName)
}

/**
 * Ranks a provider against observed federal winners without treating similarity
 * as identity verification or proof of capability. The score is discovery
 * intelligence only; independent provider evidence is still required.
 */
export function scoreProviderAgainstPreviousWins(
  candidate:PreviousWinSimilarityInput,
  anchors:PreviousWinFingerprint[],
):PreviousWinSimilarity{
  const candidatePsc=unique([...candidate.pscCodes,...pscFromKeywords(candidate.keywords)])
  const ranked=anchors
    .filter(anchor=>!sameIdentity(candidate,anchor))
    .map(anchor=>{
      let score=0
      const reasons:string[]=[]
      if(overlap(candidate.naicsCodes,anchor.naicsCodes)){score+=55;reasons.push('NAICS overlaps a previous federal winner')}
      if(overlap(candidatePsc,anchor.pscCodes)){score+=30;reasons.push('PSC overlaps a previous federal winner')}
      if(candidate.state&&anchor.state&&normalized(candidate.state)===normalized(anchor.state)){score+=5;reasons.push('geography matches a previous winner')}
      return {anchor,score:Math.min(100,score),reasons}
    })
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score||a.anchor.providerId.localeCompare(b.anchor.providerId))
    .slice(0,3)

  return {
    score:ranked[0]?.score??0,
    anchorProviderIds:ranked.map(x=>x.anchor.providerId),
    reasons:unique(ranked.flatMap(x=>x.reasons)),
    evidenceRefs:unique(ranked.flatMap(x=>x.anchor.evidenceRefs)),
  }
}

export function buildPreviousWinFingerprints(input:Array<{
  providerId:string
  providerName:string
  uei?:string
  cage?:string
  naicsCodes?:string[]
  pscCodes?:string[]
  agency?:string
  state?:string
  awardAmount?:number
  evidenceRefs?:string[]
}>):PreviousWinFingerprint[]{
  return input
    .filter(row=>row.providerId.trim()&&row.providerName.trim()&&(row.evidenceRefs?.length??0)>0)
    .map(row=>({
      id:`previous-win:${row.providerId}`,
      providerId:row.providerId.trim(),
      providerName:row.providerName.trim(),
      uei:row.uei?.trim()||undefined,
      cage:row.cage?.trim()||undefined,
      naicsCodes:unique(row.naicsCodes??[]),
      pscCodes:unique(row.pscCodes??[]),
      agency:row.agency?.trim()||undefined,
      state:row.state?.trim()||undefined,
      awardAmount:Number.isFinite(row.awardAmount)?row.awardAmount:undefined,
      evidenceRefs:unique(row.evidenceRefs??[]),
    }))
}
