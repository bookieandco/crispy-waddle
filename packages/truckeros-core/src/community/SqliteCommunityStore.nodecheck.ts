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
        assert.equal(two.incomingRequests(alice.token).length,1);
        assert.equal(two.feed(bob.token).length,1);
        two.acceptFriend(alice.token,bob.account.id);
        assert.equal(two.incomingRequests(alice.token).length,0);
        assert.equal(two.friends(alice.token).length,1);
        assert.equal(two.feed(bob.token).length,2);
        two.block(alice.token,bob.account.id);
        assert.equal(two.friends(alice.token).length,0);
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

  it("place reviews retain driver self-report provenance, consent and persisted visit context",()=>{
    const folder=mkdtempSync(join(tmpdir(),"trucker-reviews-")),file=join(folder,"social.sqlite");
    try {
      const db=new SqliteTruckerCommunity(file);
      const a=create(db,"alice"),b=create(db,"bob"),c=create(db,"carol");
      [a,b,c].forEach(u=>db.updateSettings(u.token,{enabled:true}));
      assert.throws(()=>db.createPlaceReview(a.token,{placeId:"venue-1",amenity:"showers",rating:6,body:"Bad rating"}),/rating/);
      assert.throws(()=>db.createPlaceReview(a.token,{placeId:"venue-1",amenity:"showers",rating:4,body:"Future",observedAt:"2032-01-01"}),/date/);
      assert.throws(()=>db.createPlaceReview(a.token,{placeId:"venue-1",amenity:"showers",rating:4,body:"Impossible",observedAt:"2026-02-30"}),/date/);
      const network=db.createPlaceReview(a.token,{placeId:"venue-1",amenity:"showers",rating:5,body:"Self-reported clean shower",audience:"network",observedAt:"2025-01-10"});
      db.createPlaceReview(a.token,{placeId:"venue-1",amenity:"parking",rating:2,body:"Private parking note"});
      assert.equal(db.placeReviews(b.token,"venue-1").length,1);
      assert.equal(db.placeReviews(c.token,"venue-1").length,1);
      assert.equal(db.placeReviews(b.token,"other-venue").length,0);
      const review=db.placeReviews(b.token,"venue-1")[0];
      assert.equal(review.id,network.id);
      assert.equal(review.provenance,"driver_self_report");
      assert.equal(review.observedAt,"2025-01-10");
      db.requestFriend(b.token,a.account.id);db.acceptFriend(a.token,b.account.id);
      assert.equal(db.placeReviews(b.token,"venue-1").length,2);
      db.close();
      const reopened=new SqliteTruckerCommunity(file);
      try {
        assert.equal(reopened.placeReviews(b.token,"venue-1").length,2);
        reopened.block(a.token,b.account.id);
        assert.equal(reopened.placeReviews(b.token,"venue-1").length,0);
        assert.equal(reopened.placeReviews(c.token,"venue-1").length,1);
      }finally{reopened.close();}
    }finally{rmSync(folder,{recursive:true,force:true});}
  });
  it("reports hide a post only for the reporter and cannot report hidden/friend-only items",()=>{
    const db=new SqliteTruckerCommunity(":memory:");
    try {
      const a=create(db,"alice"),b=create(db,"bob"),c=create(db,"carol");
      [a,b,c].forEach(u=>db.updateSettings(u.token,{enabled:true}));
      const review=db.createPlaceReview(a.token,{placeId:"stop-9",amenity:"parking",rating:3,body:"My parking observation",audience:"network"});
      const privatePost=db.publish(a.token,{body:"Friends only"});
      assert.throws(()=>db.reportPost(b.token,privatePost.id,"spam"),/not visible/);
      assert.throws(()=>db.reportPost(a.token,review.id,"spam"),/own post/);
      assert.throws(()=>db.reportPost(b.token,review.id,"not-a-category"),/reason/);
      assert.deepEqual(db.reportPost(b.token,review.id,"inaccurate_place_info"),{reported:true});
      assert.equal(db.placeReviews(b.token,"stop-9").length,0);
      assert.equal(db.feed(b.token).some(p=>p.id===review.id),false);
      assert.throws(()=>db.setLike(b.token,review.id,true),/not visible/);
      assert.equal(db.placeReviews(c.token,"stop-9").length,1);
      assert.equal(db.placeReviews(a.token,"stop-9").length,1);
      db.updateSettings(a.token,{enabled:false});
      assert.equal(db.placeReviews(c.token,"stop-9").length,0);
    }finally{db.close();}
  });

  it("limits password guessing durably for both known and unknown email",()=>{
    const dir=mkdtempSync(join(tmpdir(),"trucker-auth-")),file=join(dir,"social.sqlite");
    try {
      const db=new SqliteTruckerCommunity(file),alice=create(db,"alice");
      for(let i=0;i<5;i++)
        assert.throws(()=>db.login("alice@example.test","bad-password"),/Invalid credentials/);
      assert.throws(()=>db.login("alice@example.test","long-test-password-456"),/Too many login attempts/);
      for(let i=0;i<5;i++)
        assert.throws(()=>db.login("ghost@example.test","guess"),/Invalid credentials/);
      assert.throws(()=>db.login("ghost@example.test","guess"),/Too many login attempts/);
      assert.equal(db.actor(alice.token).id,alice.account.id);
      db.close();
      const reopened=new SqliteTruckerCommunity(file);
      try {
        assert.throws(()=>reopened.login("alice@example.test","long-test-password-456"),/Too many login attempts/);
        assert.equal(reopened.actor(alice.token).id,alice.account.id);
      }finally{reopened.close();}
    }finally{rmSync(dir,{recursive:true,force:true});}
  });
  it("requires explicit offline secret for moderator bootstrap and preserves report evidence",()=>{
    const db=new SqliteTruckerCommunity(":memory:",{moderatorBootstrapSecret:"trucker-offline-bootstrap-secret-for-tests-34567"});
    const ordinary=new SqliteTruckerCommunity(":memory:");
    try {
      const a=create(db,"alice"),b=create(db,"bob"),m=create(db,"moderator");
      [a,b,m].forEach(u=>db.updateSettings(u.token,{enabled:true}));
      const p=db.publish(a.token,{body:"Unsafe parking suggestion",audience:"network"});
      assert.deepEqual(db.reportPost(b.token,p.id,"unsafe_information"),{reported:true});
      assert.throws(()=>db.moderationQueue(b.token),/Forbidden/);
      assert.throws(()=>db.moderatePost(a.token,p.id,"hide","Clear safety risk"),/Forbidden/);
      assert.throws(()=>db.grantModeratorOffline("moderator@example.test","wrong"),/denied/);
      assert.throws(()=>ordinary.grantModeratorOffline("moderator@example.test","trucker-offline-bootstrap-secret-for-tests-34567"),/unavailable/);
      db.grantModeratorOffline("moderator@example.test","trucker-offline-bootstrap-secret-for-tests-34567");
      const queue=db.moderationQueue(m.token);
      assert.equal(queue.length,1);
      assert.equal(queue[0].postId,p.id);
      assert.equal(queue[0].reason,"unsafe_information");
      assert.throws(()=>db.moderatePost(m.token,p.id,"remove" as "hide","Bad action"),/Invalid moderation/);
      const h=db.moderatePost(m.token,p.id,"hide","Dangerous vehicle parking advice");
      assert.equal(typeof h.decisionId,"string");
      assert.equal(db.moderationQueue(m.token).length,0);
      assert.equal(db.feed(a.token).some(item=>item.id===p.id),false);
      assert.equal(db.feed(b.token).some(item=>item.id===p.id),false);
      assert.throws(()=>db.setLike(a.token,p.id,true),/not visible/);
      db.moderatePost(m.token,p.id,"restore","Review found report was incorrect");
      assert.equal(db.feed(a.token).some(item=>item.id===p.id),true);
      // Reporter-specific hide stays active even after global restoration.
      assert.equal(db.feed(b.token).some(item=>item.id===p.id),false);
    }finally{db.close();ordinary.close();}
  });
  it("moderation decisions survive restart and do not override private audience",()=>{
    const dir=mkdtempSync(join(tmpdir(),"trucker-moderation-")),file=join(dir,"social.sqlite");
    const secret="offline-secret-is-over-32-characters-long-54321";
    try {
      const db=new SqliteTruckerCommunity(file,{moderatorBootstrapSecret:secret});
      const author=create(db,"alice"),outsider=create(db,"bob"),mod=create(db,"mod");
      [author,outsider,mod].forEach(u=>db.updateSettings(u.token,{enabled:true}));
      const privatePost=db.publish(author.token,{body:"Friend-only information"});
      assert.equal(db.feed(outsider.token).some(x=>x.id===privatePost.id),false);
      db.grantModeratorOffline("mod@example.test",secret);
      db.moderatePost(mod.token,privatePost.id,"hide","Proactive prevention of abusive private content");
      db.close();
      const reopened=new SqliteTruckerCommunity(file);
      try {
        assert.equal(reopened.feed(author.token).some(x=>x.id===privatePost.id),false);
        assert.equal(reopened.moderationQueue(mod.token).length,0);
        reopened.moderatePost(mod.token,privatePost.id,"restore","Cleared for friends-only publishing");
        assert.equal(reopened.feed(author.token).some(x=>x.id===privatePost.id),true);
        assert.equal(reopened.feed(outsider.token).some(x=>x.id===privatePost.id),false);
      }finally{reopened.close();}
    }finally{rmSync(dir,{recursive:true,force:true});}
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
