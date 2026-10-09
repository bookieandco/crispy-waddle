import {describe,expect,it} from "vitest";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {SqliteTruckerCommunity} from "./SqliteCommunityStore.js";
function create(db:SqliteTruckerCommunity,who:string){
  const account=db.register({email:who+"@example.test",password:"long-test-password-456",handle:who,displayName:who});
  const token=db.login(who+"@example.test","long-test-password-456");
  return {account,token};
}
describe("TruckerOS durable community permissions",()=>{
  it("defaults to all privacy features off and refuses unknown sessions",()=>{
    const db=new SqliteTruckerCommunity(":memory:");
    try {
      const a=create(db,"alice");
      expect(a.account.socialEnabled).toBe(false);
      expect(a.account.discoverable).toBe(false);
      expect(a.account.crewUpEnabled).toBe(false);
      expect(()=>db.feed(a.token)).toThrow(/off/);
      expect(()=>db.actor("invalid")).toThrow(/Unauthorized/);
      expect(()=>db.login("alice@example.test","incorrect")).toThrow(/credentials/);
    } finally {db.close();}
  });
  it("persists real consent settings and friend-scoped posts across database reopen",()=>{
    const dir=mkdtempSync(join(tmpdir(),"truckeros-db-"));const path=join(dir,"social.sqlite");
    try {
      const db=new SqliteTruckerCommunity(path);
      const alice=create(db,"alice");const bob=create(db,"bob");
      db.updateSettings(alice.token,{enabled:true,discoverable:true});
      db.updateSettings(bob.token,{enabled:true});
      db.publish(alice.token,{body:"Clean showers at highway stop",kind:"review",placeId:"stop123",rating:5,audience:"network"});
      db.publish(alice.token,{body:"Friends only"});
      expect(db.feed(bob.token)).toHaveLength(1);
      db.close();
      const reopened=new SqliteTruckerCommunity(path);
      try {
        expect(reopened.feed(bob.token)).toHaveLength(1);
        expect(reopened.discover(bob.token)).toHaveLength(1);
        reopened.requestFriend(bob.token,alice.account.id);
        expect(reopened.feed(bob.token)).toHaveLength(1);
        reopened.acceptFriend(alice.token,bob.account.id);
        expect(reopened.feed(bob.token)).toHaveLength(2);
        reopened.block(alice.token,bob.account.id);
        expect(reopened.feed(bob.token)).toHaveLength(0);
        expect(()=>reopened.requestFriend(bob.token,alice.account.id)).toThrow(/Blocked/);
        reopened.logout(alice.token);
        expect(()=>reopened.actor(alice.token)).toThrow(/Unauthorized/);
      } finally {reopened.close();}
    } finally {rmSync(dir,{recursive:true,force:true});}
  });
  it("removes content from other feeds on social opt-out",()=>{
    const db=new SqliteTruckerCommunity(":memory:");
    try {
      const alice=create(db,"alice");const bob=create(db,"bob");
      db.updateSettings(alice.token,{enabled:true,discoverable:true,crewUpEnabled:true});
      db.updateSettings(bob.token,{enabled:true});
      db.publish(alice.token,{body:"Parking tip",audience:"network"});
      expect(db.feed(bob.token)).toHaveLength(1);
      db.updateSettings(alice.token,{enabled:false,discoverable:true,crewUpEnabled:true});
      expect(db.actor(alice.token).crewUpEnabled).toBe(false);
      expect(db.discover(bob.token)).toHaveLength(0);
      expect(db.feed(bob.token)).toHaveLength(0);
    } finally {db.close();}
  });
  it("never accepts weak credentials or unverified review ratings",()=>{
    const db=new SqliteTruckerCommunity(":memory:");
    try {
      expect(()=>db.register({email:"a@b.co",password:"weak",handle:"alice",displayName:"Alice"})).toThrow();
      const alice=create(db,"alice");db.updateSettings(alice.token,{enabled:true});
      expect(()=>db.publish(alice.token,{body:"Nice",kind:"review",placeId:"abc",rating:8})).toThrow();
      expect(()=>db.publish(alice.token,{body:"No group",audience:"group" as "friends"})).toThrow();
      const post=db.publish(alice.token,{body:"Showers are nice",kind:"review",placeId:"abc",rating:5});
      expect(post.placeId).toBe("abc");
      expect(JSON.stringify(post)).not.toMatch(/password|session|latitude|longitude|gps/i);
    } finally {db.close();}
  });
});
