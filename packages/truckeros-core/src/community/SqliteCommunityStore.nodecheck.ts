/** Native Node test runner for node:sqlite, isolated from Vitest's Vite resolver. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {SqliteTruckerCommunity} from "./SqliteCommunityStore.js";

function create(db:SqliteTruckerCommunity,handle:string) {
  const account=db.register({email:handle+"@example.test",password:"long-test-password-456",handle,displayName:handle});
  const token=db.login(handle+"@example.test","long-test-password-456");
  return {account,token};
}
describe("TruckerOS SQLite social permissions with native Node",()=>{
  it("defaults OFF and refuses invalid sessions and weak passwords",()=>{
    const db=new SqliteTruckerCommunity(":memory:");
    try {
      assert.throws(()=>db.register({email:"test@example.test",password:"weak",handle:"test",displayName:"Test"}));
      const a=create(db,"alice");
      assert.equal(a.account.socialEnabled,false);
      assert.equal(a.account.discoverable,false);
      assert.equal(a.account.crewUpEnabled,false);
      assert.throws(()=>db.feed(a.token),/off/);
      assert.throws(()=>db.actor("invalid"),/Unauthorized/);
      assert.throws(()=>db.login("alice@example.test","incorrect"),/credentials/);
    }finally{db.close();}
  });
  it("persists network/friends posts and opt-in across database restart",()=>{
    const dir=mkdtempSync(join(tmpdir(),"truckeros-community-"));
    const path=join(dir,"social.sqlite");
    try {
      const one=new SqliteTruckerCommunity(path);
      const alice=create(one,"alice"),bob=create(one,"bob");
      one.updateSettings(alice.token,{enabled:true,discoverable:true});
      one.updateSettings(bob.token,{enabled:true});
      const review=one.publish(alice.token,{body:"Clean showers",kind:"review",placeId:"plaza1",rating:5,audience:"network"});
      assert.equal(review.rating,5);
      const friendsOnly=one.publish(alice.token,{body:"Coffee with friends"});
      assert.equal(one.feed(bob.token).length,1);
      one.close();
      const two=new SqliteTruckerCommunity(path);
      try{
        assert.equal(two.feed(bob.token).length,1);
        assert.equal(two.discover(bob.token)[0].handle,"alice");
        two.requestFriend(bob.token,alice.account.id);
        assert.equal(two.feed(bob.token).length,1);
        two.acceptFriend(alice.token,bob.account.id);
        assert.equal(two.feed(bob.token).length,2);
        two.block(alice.token,bob.account.id);
        assert.equal(two.feed(bob.token).length,0);
        assert.throws(()=>two.setLike(bob.token,friendsOnly.id,true),/not visible/);
        assert.throws(()=>two.requestFriend(bob.token,alice.account.id),/Blocked/);
        two.logout(alice.token);
        assert.throws(()=>two.actor(alice.token),/Unauthorized/);
      }finally{two.close();}
    }finally{rmSync(dir,{recursive:true,force:true});}
  });
  it("enforces visibility on likes, bookmarks, comments, replies and counters",()=>{
    const db=new SqliteTruckerCommunity(":memory:");
    try {
      const alice=create(db,"alice"),bob=create(db,"bob"),charlie=create(db,"charlie");
      [alice,bob,charlie].forEach(u=>db.updateSettings(u.token,{enabled:true}));
      const post=db.publish(alice.token,{body:"Showers or laundry recommendations?"});
      assert.throws(()=>db.setLike(bob.token,post.id,true),/not visible/);
      assert.throws(()=>db.addComment(charlie.token,post.id,"Not a friend"),/not visible/);
      db.requestFriend(bob.token,alice.account.id);
      db.acceptFriend(alice.token,bob.account.id);
      db.setLike(bob.token,post.id,true);
      db.setLike(bob.token,post.id,true);
      db.setBookmark(bob.token,post.id,true);
      const parent=db.addComment(bob.token,post.id,"The travel plaza has a shower");
      const reply=db.addComment(alice.token,post.id,"Thank you!",parent.id);
      assert.equal(reply.parentId,parent.id);
      assert.equal(db.comments(bob.token,post.id).length,2);
      assert.deepEqual(db.engagement(bob.token,post.id),
        {likeCount:1,commentCount:2,likedByMe:true,bookmarkedByMe:true});
      assert.throws(()=>db.addComment(bob.token,post.id,"bad","nonexistent-parent"),/not visible/);
      db.setLike(bob.token,post.id,false);
      db.setBookmark(bob.token,post.id,false);
      assert.equal(db.engagement(bob.token,post.id).likeCount,0);
      assert.equal(db.engagement(bob.token,post.id).bookmarkedByMe,false);
      db.block(alice.token,bob.account.id);
      assert.throws(()=>db.comments(bob.token,post.id),/not visible/);
      assert.equal(db.comments(alice.token,post.id).length,1);
      assert.equal(db.engagement(alice.token,post.id).commentCount,1);
    }finally{db.close();}
  });
  it("opt-out hides posts and interactions while preserving driver utilities",()=>{
    const db=new SqliteTruckerCommunity(":memory:");
    try {
      const a=create(db,"alice"),b=create(db,"bob");
      db.updateSettings(a.token,{enabled:true,discoverable:true,crewUpEnabled:true});
      db.updateSettings(b.token,{enabled:true});
      const p=db.publish(a.token,{body:"Parking tips",audience:"network"});
      db.addComment(b.token,p.id,"Useful");
      assert.equal(db.feed(b.token).length,1);
      db.updateSettings(a.token,{enabled:false,discoverable:true,crewUpEnabled:true});
      assert.equal(db.actor(a.token).crewUpEnabled,false);
      assert.equal(db.feed(b.token).length,0);
      assert.equal(db.discover(b.token).length,0);
      assert.throws(()=>db.setBookmark(b.token,p.id,true),/not visible/);
    }finally{db.close();}
  });
});
