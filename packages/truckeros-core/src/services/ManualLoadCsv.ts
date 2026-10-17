/** Manual and CSV user-supplied freight offers. Never presents these as verified load-board quotes. */
import type {LoadOffer} from "../interfaces/dispatcher.js";

const MAX_CSV_CHARS = 64_000;
const REQUIRED = ["origin","destination","revenue","loadedmiles","deadheadmiles","fuelcost","tollcost","othercost"] as const;
type Row = string[];

function csvRows(source:string):Row[] {
  const input=source.replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n");
  const rows:Row[]=[];
  let row:Row=[],field="",quoted=false,justClosed=false;
  function pushField():void { row.push(field.trim());field="";justClosed=false; }
  function pushRow():void { pushField();if(row.some(x=>x.length>0))rows.push(row);row=[]; }
  for(let i=0;i<input.length;i++) {
    const ch=input[i];
    if(ch==='"') {
      if(quoted && input[i+1]==='"') {field+='"';i++;continue;}
      if(quoted) {quoted=false;justClosed=true;continue;}
      if(field.trim()!=="" || justClosed)throw Error("Invalid CSV quotation");
      quoted=true;
    } else if(!quoted && ch===",") {
      pushField();
    } else if(!quoted && ch==="\n") {
      pushRow();
    } else if(!quoted && justClosed && ch!==" " && ch!=="\t") {
      throw Error("Unexpected characters after quoted CSV cell");
    } else {
      field+=ch;
    }
  }
  if(quoted)throw Error("Unclosed CSV quotation");
  if(field!==""||row.length>0||justClosed)pushRow();
  return rows;
}
function dollars(raw:string,positive=false):number{
  if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(raw))throw Error("Invalid CSV money amount");
  const [whole,fraction=""]=raw.split(".");
  const cents=Number(whole)*100+Number(fraction.padEnd(2,"0"));
  if(!Number.isSafeInteger(cents)||(positive&&cents<=0))throw Error("Invalid CSV amount");
  return cents;
}
function miles(raw:string,positive=false):number{
  if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(raw))throw Error("Invalid CSV mileage");
  const value=Number(raw);
  if(!Number.isFinite(value)||(positive&&value<=0))throw Error("Invalid CSV mileage");
  return value;
}
function place(raw:string):string{
  const v=raw.trim();
  if(v.length<2||v.length>120||/^[=+\-@\t]/.test(v))throw Error("Unsafe or missing CSV city");
  return v;
}
export function parseManualLoadCsv(source:string,idFactory:()=>string):LoadOffer[]{
  if(typeof source!=="string"||source.length>MAX_CSV_CHARS)throw Error("CSV too large");
  const rows=csvRows(source);
  if(rows.length<2)throw Error("CSV must contain headers and at least one offer");
  const headers=rows[0].map(x=>x.toLowerCase().trim());
  if(new Set(headers).size!==headers.length)throw Error("Duplicate CSV columns");
  for(const h of REQUIRED)if(!headers.includes(h))throw Error("Missing CSV column: "+h);
  if(rows.length>21)throw Error("CSV supports at most 20 offers");
  const get=(row:Row,name:string):string=>{
    const pos=headers.indexOf(name);
    return pos<0?"":row[pos]??"";
  };
  return rows.slice(1).map((row,i)=>{
    if(row.length!==headers.length)throw Error("CSV column count mismatch on row "+(i+2));
    const broker=get(row,"broker").trim();
    if(broker.length>120||/^[=+\-@\t]/.test(broker))throw Error("Unsafe broker name");
    const id=idFactory();
    if(!id||id.length>128)throw Error("Invalid generated ID");
    return {
      id,origin:place(get(row,"origin")),destination:place(get(row,"destination")),
      pickupAt:null,deliveryAt:null,
      revenueCents:dollars(get(row,"revenue"),true),
      loadedMiles:miles(get(row,"loadedmiles"),true),
      deadheadMiles:miles(get(row,"deadheadmiles")),
      fuelCostCents:dollars(get(row,"fuelcost")),
      tollCostCents:dollars(get(row,"tollcost")),
      otherCostCents:dollars(get(row,"othercost")),
      brokerName:broker||null,
    };
  });
}
