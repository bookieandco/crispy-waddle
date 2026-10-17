import assert from "node:assert/strict";
import test from "node:test";
import {qualifyDestination,type TripContext,type StopContext,type LifestyleDestination} from "./index.ts";
const at="2026-10-16T12:00:00Z";
const recent="2026-10-16T11:45:00Z";
const access={fullRigAccessible:true,bobtailAccessible:true,ridesharePickupAvailable:true,pedestrianAccess:true,verifiedAt:recent};
const context:TripContext={
  tripId:"demo-trip",driverId:"driver-1",truckId:"rig-1",
  currentLocation:{latitude:32,longitude:-97},
  equipment:{mode:"full_rig",trailerLengthFeet:53},
  operating:{status:"off_duty",resetWindow:"rest_period",availableMinutes:180,observedAt:recent,source:"manual"},
  createdAt:at
};
const stop:StopContext={stopId:"stop-1",name:"Verified truck stop",location:{latitude:32,longitude:-97},
distanceMeters:0,logistics:{...access}};
const venue:LifestyleDestination={
  destinationId:"venue-1",name:"Cafe",location:{latitude:32.01,longitude:-97.01},supportedMoods:["quiet_chill"],
  allowedMobilityModes:["rideshare","walk_out"],distanceMeters:1500,openNow:true,logistics:{...access}
};
test("verified, parked off-duty access can be mobility-qualified with explicit return-time caution",()=>{
 const x=qualifyDestination(context,stop,venue,new Date(at));
 assert.equal(x.qualified,true);
 assert.equal(x.mobilityMode,"rideshare");
 assert.match(x.warnings.join(" "),/Return-to-rig travel/);
});
test("driving, unknown and sleeper-berth-only operation never qualifies as off-duty",()=>{
 for(const status of ["driving","on_duty","unknown","sleeper_berth"] as const){
  const x=qualifyDestination({...context,operating:{...context.operating,status}},stop,venue,new Date(at));
  assert.equal(x.qualified,false);
 }
});
test("crowd-only, stale and future stop access cannot be called verified",()=>{
 for(const verifiedAt of [undefined,"2026-10-15T08:00:00Z","2026-10-16T12:02:00Z"]){
  const x=qualifyDestination(context,{...stop,logistics:{...stop.logistics,verifiedAt}},venue,new Date(at));
  assert.equal(x.qualified,false);
 }
 const y=qualifyDestination(context,stop,{...venue,logistics:{...venue.logistics,verifiedAt:undefined}},new Date(at));
 assert.equal(y.qualified,false);
});
test("no trusted available-time window refuses to declare safe off-duty outing",()=>{
 const x=qualifyDestination({...context,operating:{...context.operating,availableMinutes:undefined}},stop,venue,new Date(at));
 assert.equal(x.qualified,false);
});
