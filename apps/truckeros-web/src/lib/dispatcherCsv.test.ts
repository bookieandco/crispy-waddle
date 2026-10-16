import {describe,it,expect} from "vitest"
import {parseDispatcherCsv} from "./dispatcherCsv"
const hdr="origin,destination,grossPay,loadedMiles,deadheadMiles,fuelCost,tollCost,otherCost,broker"
const row='"Houston, TX","Dallas, TX",2400.50,200,18,400.25,15,32,"Broker, LLC"'
describe("Dispatcher free CSV intake",()=>{
  it("imports quoted commas with fixed-precision costs and unverified ownership",()=>{
    const [a]=parseDispatcherCsv("\uFEFF"+hdr+"\r\n"+row,()=>"fixture")
    expect(a).toMatchObject({id:"csv_fixture",origin:"Houston, TX",destination:"Dallas, TX",revenueCents:240050,loadedMiles:200,deadheadMiles:18,fuelCostCents:40025,tollCostCents:1500,otherCostCents:3200,brokerName:"Broker, LLC"})
  })
  it("requires costs and valid finite economic values",()=>{
    expect(()=>parseDispatcherCsv("origin,destination,grossPay,loadedMiles,deadheadMiles\nA,B,200,25,2")).toThrow(/CSV_MISSING_FUELCOST/)
    expect(()=>parseDispatcherCsv(hdr+"\n"+row.replace("400.25","-1"))).toThrow(/CSV_INVALID_FUELCOST/)
    expect(()=>parseDispatcherCsv(hdr+"\n"+row.replace("2400.50","Infinity"))).toThrow()
    expect(()=>parseDispatcherCsv(hdr+"\n"+row.replace("2400.50","0"))).toThrow()
  })
  it("refuses unbalanced quotes, duplicate headers and 21 load rows",()=>{
    expect(()=>parseDispatcherCsv(hdr+"\n"+row.slice(0,-1))).toThrow("CSV_UNCLOSED_QUOTE")
    expect(()=>parseDispatcherCsv("origin,origin\nA,B")).toThrow("CSV_DUPLICATE_HEADER")
    expect(()=>parseDispatcherCsv(hdr+"\n"+Array(21).fill(row).join("\n"))).toThrow("CSV_TOO_MANY_LOADS")
  })
})
