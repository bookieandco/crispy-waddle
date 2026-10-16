/** Free, owner-supplied load CSV parser. Entirely offline/unverified; never books freight. */
import { parseLoadCsvRow } from "@jhadina/truckeros-core/loads"
import type { LoadOffer } from "@jhadina/truckeros-core"

const REQUIRED=["origin","destination","grossPay","loadedMiles","deadheadMiles","fuelCost","tollCost","otherCost"] as const
const MAX_ROWS=20
const MAX_LENGTH=32_768

/** Quoted CSV fields, doubled quotes, BOM and CRLF; no undocumented delimiter guessing. */
function fields(source:string):string[][] {
  const rows:string[][]=[]
  let current:string[]=[]
  let value="",quoted=false,afterQuote=false,atStart=true
  const flush=()=>{current.push(value);value="";atStart=true;afterQuote=false}
  const endRow=()=>{flush();rows.push(current);current=[]}
  for(let i=0;i<source.length;i++){
    const c=source[i]
    if(quoted){
      if(c==='"' && source[i+1]==='"'){value+='"';i++}
      else if(c==='"'){quoted=false;afterQuote=true}
      else value+=c
    } else if(c==='"'){
      if(!atStart || afterQuote)throw Error("CSV_INVALID_QUOTE")
      quoted=true;atStart=false
    } else if(c===","){flush()}
    else if(c==="\r" || c==="\n"){
      if(c==="\r" && source[i+1]==="\n")i++
      endRow()
    } else {
      if(afterQuote && c!==" " && c!=="\t")throw Error("CSV_TRAILING_CHARS")
      value+=c;atStart=false
    }
  }
  if(quoted)throw Error("CSV_UNCLOSED_QUOTE")
  if(value.length || current.length)endRow()
  return rows.filter(row=>row.some(v=>v.trim()!==""))
}
function cents(value:string,field:string):number{
  if(!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(value.trim()))throw Error("CSV_INVALID_"+field.toUpperCase())
  const amount=Math.round(Number(value)*100)
  if(!Number.isSafeInteger(amount)||amount<0)throw Error("CSV_INVALID_"+field.toUpperCase())
  return amount
}
export function parseDispatcherCsv(source:string,makeId:()=>string=()=>crypto.randomUUID()):LoadOffer[]{
  if(source.length>MAX_LENGTH)throw Error("CSV_TOO_LARGE")
  const data=fields(source.replace(/^\uFEFF/,""))
  if(data.length<2)throw Error("CSV_REQUIRES_HEADER_AND_ROW")
  const header=data[0].map(value=>value.trim())
  if(new Set(header).size!==header.length)throw Error("CSV_DUPLICATE_HEADER")
  for(const col of REQUIRED)if(!header.includes(col))throw Error("CSV_MISSING_"+col.toUpperCase())
  if(data.length-1>MAX_ROWS)throw Error("CSV_TOO_MANY_LOADS")
  return data.slice(1).map((cells,index)=>{
    if(cells.length!==header.length)throw Error("CSV_COLUMN_COUNT_ROW_"+(index+2))
    const record=Object.fromEntries(header.map((key,i)=>[key,cells[i]?.trim()??""])) as Record<string,string>
    // The label is intentionally NOT caller's claimed load-board/provider identity.
    record.provider="manual_csv_unverified"
    record.id="import_"+(index+1)
    const {load}=parseLoadCsvRow(record)
    const fuelCostCents=cents(record.fuelCost,"fuelCost")
    const tollCostCents=cents(record.tollCost,"tollCost")
    const otherCostCents=cents(record.otherCost,"otherCost")
    const gross=cents(record.grossPay,"grossPay")
    if(gross===0)throw Error("CSV_GROSS_PAY_INVALID")
    const id=makeId()
    if(!id || id.length>120)throw Error("CSV_ID_INVALID")
    return {
      id:"csv_"+id,
      origin:load.origin,
      destination:load.destination,
      pickupAt:load.pickupAt??null,
      deliveryAt:load.deliveryAt??null,
      revenueCents:gross,
      loadedMiles:load.loadedMiles,
      deadheadMiles:load.deadheadMiles,
      fuelCostCents,
      tollCostCents,
      otherCostCents,
      brokerName:record.broker?.trim()||null
    }
  })
}
