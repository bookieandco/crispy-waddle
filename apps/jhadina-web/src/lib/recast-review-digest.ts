import {createHash} from 'node:crypto'

/** Deterministic JSON representation for immutable review evidence.
 * Sort object keys recursively so PostgreSQL jsonb key normalization cannot
 * accidentally invalidate a genuine sealed receipt. Reject lossy values. */
export function canonicalRecastEvidence(value:unknown):string {
  function encode(input:unknown,depth:number):string{
    if(depth>40)throw new Error('DIRECTOR_RECAST_EVIDENCE_DEPTH_EXCEEDED')
    if(input===null)return 'null'
    if(typeof input==='string')return JSON.stringify(input)
    if(typeof input==='boolean')return input?'true':'false'
    if(typeof input==='number'&&Number.isFinite(input))return JSON.stringify(input)
    if(Array.isArray(input)){
      if(input.length>20000)throw new Error('DIRECTOR_RECAST_EVIDENCE_ARRAY_TOO_LARGE')
      return '['+input.map(item=>encode(item,depth+1)).join(',')+']'
    }
    if(typeof input==='object'){
      const record=input as Record<string,unknown>
      const keys=Object.keys(record).sort()
      if(keys.length>10000)throw new Error('DIRECTOR_RECAST_EVIDENCE_OBJECT_TOO_LARGE')
      return '{'+keys.map(k=>JSON.stringify(k)+':'+encode(record[k],depth+1)).join(',')+'}'
    }
    throw new Error('DIRECTOR_RECAST_EVIDENCE_NON_JSON_VALUE')
  }
  const encoded=encode(value,0)
  if(encoded.length>250000)throw new Error('DIRECTOR_RECAST_EVIDENCE_TOO_LARGE')
  return encoded
}
export function sealRecastEvidence(value:unknown):string{
  return createHash('sha256').update(canonicalRecastEvidence(value),'utf8').digest('hex')
}
export function verifyRecastEvidenceSeal(value:unknown,seal:unknown):boolean{
  if(typeof seal!=='string'||!/^[0-9a-f]{64}$/i.test(seal))return false
  try{return sealRecastEvidence(value)===seal.toLowerCase()}
  catch{return false}
}
