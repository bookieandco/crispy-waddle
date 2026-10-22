/**
 * Bound both count and UTF-8 size of SAM runtime gateway writes.
 * The production gateway accepts at most 5 MB total JSON and 500 rows.
 * 850 KB leaves room for envelopes, headers and future fields.
 */
export function splitSamGatewayBatches<T>(rows:readonly T[],maxRows=40,maxBytes=850_000):T[][]{
  if(!Number.isInteger(maxRows)||maxRows<1||maxRows>500)throw new Error('SAM_INVALID_BATCH_ROWS')
  if(!Number.isInteger(maxBytes)||maxBytes<1024||maxBytes>4_000_000)throw new Error('SAM_INVALID_BATCH_BYTES')
  const result:T[][]=[]
  let batch:T[]=[]
  let bytes=2
  const encoder=new TextEncoder()
  for(const row of rows){
    const serialized=JSON.stringify(row)
    if(serialized===undefined)throw new Error('SAM_UNSERIALIZABLE_ROW')
    const rowBytes=encoder.encode(serialized).byteLength
    if(rowBytes+2>maxBytes)throw new Error('SAM_SINGLE_ROW_EXCEEDS_GATEWAY_BUDGET')
    if(batch.length && (batch.length>=maxRows || bytes+rowBytes+1>maxBytes)){
      result.push(batch)
      batch=[]
      bytes=2
    }
    batch.push(row)
    bytes+=rowBytes+1
  }
  if(batch.length)result.push(batch)
  return result
}
