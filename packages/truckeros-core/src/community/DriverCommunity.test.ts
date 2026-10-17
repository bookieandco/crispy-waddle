import {describe,expect,it} from "vitest";
import {TruckerCommunity} from "./DriverCommunity.js";
function joined(...ids:string[]):TruckerCommunity {
  const c=new TruckerCommunity();
  ids.forEach(id=>c.updateSettings(id,{enabled:true}));
  return c;
}
describe("Trucker community opt-in and visibility",()=>{
  it("is disabled, undiscoverable and absent from Crew-Up by default",()=>{
    const c=new TruckerCommunity();
    expect(c.settings("driver")).toEqual({
      memberId:"driver",enabled:false,discoverable:false,crewUpEnabled:false
    });
    expect(()=>c.post("driver",{body:"hello"})).toThrow(/off/);
  });
  it("does not show profiles or friend posts to strangers",()=>{
    const c=joined("alice","bob");
    c.saveProfile("alice",{handle:"trucker_alice",displayName:"Alice",bio:"OTR"});
    expect(c.searchProfiles("bob")).toHaveLength(0);
    c.updateSettings("alice",{discoverable:true});
    expect(c.searchProfiles("bob")).toHaveLength(1);
    c.post("alice",{body:"Road check"});
    expect(c.feed("bob")).toHaveLength(0);
    c.requestFriend("bob","alice");
    expect(c.feed("bob")).toHaveLength(0);
    c.acceptFriend("alice","bob");
    expect(c.feed("bob")).toHaveLength(1);
    c.block("alice","bob");
    expect(c.feed("bob")).toHaveLength(0);
  });
  it("hides prior content when someone opts out",()=>{
    const c=joined("alice","bob");
    c.post("alice",{body:"Public review",audience:"network"});
    expect(c.feed("bob")).toHaveLength(1);
    c.updateSettings("alice",{enabled:false,discoverable:true,crewUpEnabled:true});
    expect(c.settings("alice").discoverable).toBe(false);
    expect(c.settings("alice").crewUpEnabled).toBe(false);
    expect(c.feed("bob")).toHaveLength(0);
  });
  it("enforces group membership and explicit review ratings",()=>{
    const c=joined("alice","bob");
    c.createGroup("alice","g","Midwest Drivers",true);
    expect(()=>c.joinGroup("bob","g")).toThrow();
    c.inviteToGroup("alice","bob","g");
    c.post("alice",{body:"Route news",audience:"group",groupId:"g"});
    expect(c.feed("bob")).toHaveLength(1);
    expect(()=>c.post("alice",{body:"Bad rating",kind:"review",placeId:"stop",rating:9})).toThrow();
    const p=c.post("alice",{body:"Clean showers",kind:"review",placeId:"stop",rating:5,audience:"network"});
    expect(p.rating).toBe(5);
    expect(JSON.stringify(p)).not.toMatch(/latitude|longitude|liveLocation|eld/);
  });
  it("meetups are invitation-scoped and never expose GPS",()=>{
    const c=joined("alice","bob");
    c.requestFriend("alice","bob");c.acceptFriend("bob","alice");
    const m=c.makeMeetup("alice",{
      title:"Coffee break",region:"Dallas area",publicVenueName:"Travel Plaza",
      startsAt:new Date(Date.now()+86400000).toISOString(),audience:"friends"
    });
    expect(c.browseMeetups("bob")[0].id).toBe(m.id);
    expect(JSON.stringify(m)).not.toMatch(/latitude|longitude|liveLocation/);
    c.block("alice","bob");
    expect(c.browseMeetups("bob")).toHaveLength(0);
  });
  it("allows moderation reports only for visible posts",()=>{
    const c=joined("alice","bob");
    const p=c.post("alice",{body:"Trucker news",audience:"network"});
    expect(c.report("bob",p.id,"spam").reason).toBe("spam");
    c.block("alice","bob");
    expect(()=>c.report("bob",p.id,"spam")).toThrow();
  });
});
