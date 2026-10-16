import {describe,it,expect} from "vitest";
import {parseManualLoadCsv} from "./ManualLoadCsv";
const columns="origin,destination,revenue,loadedMiles,deadheadMiles,fuelCost,tollCost,otherCost,broker";
let index=0;const id=()=> "manual-test-"+(++index);
describe("unverified manual freight CSV import",()=>{
  it("accepts quoted cities, escaped quotes and integer cents without booking",()=>{
    const csv=columns+"\n\"Dallas, TX\",\"St. Louis, MO\",1280.75,440,30,310.20,12,0,\"Agency \"\"A\"\"\"";
    const [load]=parseManualLoadCsv(csv,id);
    expect(load).toMatchObject({origin:"Dallas, TX",destination:"St. Louis, MO",revenueCents:128075,loadedMiles:440,deadheadMiles:30,fuelCostCents:31020,tollCostCents:1200,otherCostCents:0,brokerName:'Agency "A"'});
    expect(load.id).toMatch(/^manual-test-/);
    expect("booking" in load).toBe(false);
  });
  it("does not interpret CSV formulas or unauthenticated provider claims",()=>{
    expect(()=>parseManualLoadCsv(columns+"\n=IMPORTXML(foo),LA,100,10,0,0,0,0,Broker",id)).toThrow(/Unsafe/);
    expect(()=>parseManualLoadCsv(columns+"\nLA,NY,10.999,10,0,0,0,0,Broker",id)).toThrow(/money/);
    expect(()=>parseManualLoadCsv(columns+"\nLA,NY,0,10,0,0,0,0,Broker",id)).toThrow(/amount/);
    expect(()=>parseManualLoadCsv(columns+"\nLA,NY,100,0,0,0,0,0,Broker",id)).toThrow(/mileage/);
  });
  it("rejects malformed, duplicate, missing and excessive data",()=>{
    expect(()=>parseManualLoadCsv("origin,destination\nLA,NY",id)).toThrow(/Missing/);
    expect(()=>parseManualLoadCsv("origin,origin\nLA,NY",id)).toThrow(/Duplicate/);
    expect(()=>parseManualLoadCsv(columns+"\nLA,NY,100,10,0,0,0",id)).toThrow(/column count/);
    expect(()=>parseManualLoadCsv(columns+"\n"+Array(21).fill("LA,NY,100,10,0,0,0,0,").join("\n"),id)).toThrow(/20/);
    expect(()=>parseManualLoadCsv(columns+"\n\"LA,NY,100,10,0,0,0,0,",id)).toThrow(/Unclosed/);
  });
});
