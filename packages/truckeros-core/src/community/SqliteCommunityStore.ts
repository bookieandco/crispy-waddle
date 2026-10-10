/** Node-only SQLite community persistence; never import this into a client component.
 * Requires Node >=22.16 and a persistent storage volume. HTTP exposure is NOT implemented.
 */
// @ts-ignore: Node >=22 includes node:sqlite; monorepo @types/node is pinned to 20.
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

type Value = string | number | null;
interface Stmt { run(...x:Value[]):unknown; get(...x:Value[]):unknown; all(...x:Value[]):unknown[]; }
interface DB { exec(query:string):void; prepare(query:string):Stmt; close():void; }
interface Member { id:string; email:string; handle:string; password_hash:string; display_name:string;
  bio:string; region:string|null; social_enabled:number; discoverable:number; crew_up_enabled:number; }
export interface CommunityActor { id:string; handle:string; displayName:string; bio:string; region:string|null;
  socialEnabled:boolean; discoverable:boolean; crewUpEnabled:boolean; }
export interface CommunityFeedPost {id:string; authorId:string; handle:string; displayName:string; body:string;
  audience:"network"|"friends"; kind:"update"|"review"|"recommendation"; placeId:string|null;
  rating:number|null; createdAt:string;}
function redact(m:Member):CommunityActor {return {id:m.id,handle:m.handle,displayName:m.display_name,bio:m.bio,
  region:m.region,socialEnabled:m.social_enabled===1,discoverable:m.discoverable===1,crewUpEnabled:m.crew_up_enabled===1};}
function text(v:string,max:number,min=1):string {
  if(typeof v!=="string"||v.trim().length<min||v.length>max)throw Error("Invalid text");
  return v.trim();
}
function tokenDigest(token:string):string{return createHash("sha256").update(token).digest("hex");}
function pair(a:string,b:string):[string,string]{return a<b?[a,b]:[b,a];}
function secret(password:string):string {
  text(password,128,12);
  const salt=randomBytes(16).toString("hex");
  return salt+":"+scryptSync(password,salt,64).toString("hex");
}
function check(password:string,stored?:string):boolean {
  if(typeof password!=="string"||password.length>128)return false;
  const [salt,hex]=stored?.split(":")??["28b51fb4d19365470f466875b012b613",""];
  const expected=/^[a-f0-9]{128}$/.test(hex)?Buffer.from(hex,"hex"):Buffer.alloc(64);
  return timingSafeEqual(expected,scryptSync(password,salt,64))&&!!stored;
}
export class SqliteTruckerCommunity {
  private readonly db:DB;
  private readonly bootstrapHash:Buffer|null;
  constructor(path:string,options?:{moderatorBootstrapSecret?:string}) {
    const key=options?.moderatorBootstrapSecret;
    if(key!==undefined&&(typeof key!=="string"||key.length<32))throw Error("Weak offline moderator bootstrap secret");
    this.bootstrapHash=key?createHash("sha256").update(key).digest():null;
    if(!path)throw Error("SQLite file path is required");
    if(path!==":memory:")mkdirSync(dirname(resolve(path)),{recursive:true});
    this.db=new DatabaseSync(path) as DB;
    this.db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    this.db.exec([
      "CREATE TABLE IF NOT EXISTS driver_accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,handle TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,display_name TEXT NOT NULL,bio TEXT NOT NULL DEFAULT '',region TEXT,social_enabled INTEGER NOT NULL DEFAULT 0 CHECK(social_enabled IN (0,1)),discoverable INTEGER NOT NULL DEFAULT 0 CHECK(discoverable IN (0,1)),crew_up_enabled INTEGER NOT NULL DEFAULT 0 CHECK(crew_up_enabled IN (0,1)),created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS driver_sessions(token_digest TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES driver_accounts(id) ON DELETE CASCADE,expires_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS driver_posts(id TEXT PRIMARY KEY,author_id TEXT NOT NULL REFERENCES driver_accounts(id) ON DELETE CASCADE,body TEXT NOT NULL,audience TEXT NOT NULL CHECK(audience IN ('network','friends')),kind TEXT NOT NULL CHECK(kind IN ('update','review','recommendation')),place_id TEXT,rating INTEGER CHECK(rating BETWEEN 1 AND 5),created_at TEXT NOT NULL)",
      "CREATE INDEX IF NOT EXISTS driver_posts_recent ON driver_posts(created_at DESC)",
      "CREATE TABLE IF NOT EXISTS driver_friend_requests(requester_id TEXT NOT NULL REFERENCES driver_accounts(id) ON DELETE CASCADE,recipient_id TEXT NOT NULL REFERENCES driver_accounts(id) ON DELETE CASCADE,created_at TEXT NOT NULL,PRIMARY KEY(requester_id,recipient_id))",
      "CREATE TABLE IF NOT EXISTS driver_friendships(low_id TEXT NOT NULL REFERENCES driver_accounts(id) ON DELETE CASCADE,high_id TEXT NOT NULL REFERENCES driver_accounts(id) ON DELETE CASCADE,created_at TEXT NOT NULL,PRIMARY KEY(low_id,high_id))",
      "CREATE TABLE IF NOT EXISTS driver_blocks(blocker_id TEXT NOT NULL REFERENCES driver_accounts(id) ON DELETE CASCADE,blocked_id TEXT NOT NULL REFERENCES driver_accounts(id) ON DELETE CASCADE,created_at TEXT NOT NULL,PRIMARY KEY(blocker_id,blocked_id))",
      "CREATE TABLE IF NOT EXISTS driver_community_groups(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES driver_accounts(id),name TEXT NOT NULL,visibility TEXT NOT NULL CHECK(visibility IN ('listed','private')))",
      "CREATE TABLE IF NOT EXISTS driver_group_members(group_id TEXT NOT NULL REFERENCES driver_community_groups(id),member_id TEXT NOT NULL REFERENCES driver_accounts(id),PRIMARY KEY(group_id,member_id))",
      "CREATE TABLE IF NOT EXISTS driver_meetups(id TEXT PRIMARY KEY,organizer_id TEXT NOT NULL REFERENCES driver_accounts(id),group_id TEXT REFERENCES driver_community_groups(id),title TEXT NOT NULL,region TEXT NOT NULL,public_venue_name TEXT NOT NULL,starts_at TEXT NOT NULL,audience TEXT NOT NULL CHECK(audience IN ('friends','group')))",
      "CREATE TABLE IF NOT EXISTS driver_reports(id TEXT PRIMARY KEY,reporter_id TEXT NOT NULL REFERENCES driver_accounts(id),post_id TEXT NOT NULL REFERENCES driver_posts(id),reason TEXT NOT NULL,created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS driver_post_likes(post_id TEXT NOT NULL REFERENCES driver_posts(id) ON DELETE CASCADE,member_id TEXT NOT NULL REFERENCES driver_accounts(id) ON DELETE CASCADE,created_at TEXT NOT NULL,PRIMARY KEY(post_id,member_id))",
      "CREATE TABLE IF NOT EXISTS driver_post_bookmarks(post_id TEXT NOT NULL REFERENCES driver_posts(id) ON DELETE CASCADE,member_id TEXT NOT NULL REFERENCES driver_accounts(id) ON DELETE CASCADE,created_at TEXT NOT NULL,PRIMARY KEY(post_id,member_id))",
      "CREATE TABLE IF NOT EXISTS driver_post_comments(id TEXT PRIMARY KEY,post_id TEXT NOT NULL REFERENCES driver_posts(id) ON DELETE CASCADE,member_id TEXT NOT NULL REFERENCES driver_accounts(id) ON DELETE CASCADE,parent_id TEXT REFERENCES driver_post_comments(id) ON DELETE CASCADE,body TEXT NOT NULL,created_at TEXT NOT NULL)",
      "CREATE INDEX IF NOT EXISTS driver_post_comments_by_post ON driver_post_comments(post_id,created_at)",
      "CREATE TABLE IF NOT EXISTS driver_place_review_details(post_id TEXT PRIMARY KEY REFERENCES driver_posts(id) ON DELETE CASCADE,amenity TEXT NOT NULL CHECK(amenity IN ('showers','parking','fuel','laundry','repairs','restrooms','food','general')),observed_at TEXT,provenance TEXT NOT NULL DEFAULT 'driver_self_report' CHECK(provenance='driver_self_report'))",
      "CREATE INDEX IF NOT EXISTS driver_place_review_lookup ON driver_posts(place_id,created_at DESC)",
      "CREATE UNIQUE INDEX IF NOT EXISTS driver_one_report_per_post ON driver_reports(reporter_id,post_id)",
      "CREATE TABLE IF NOT EXISTS driver_auth_failures(key_digest TEXT PRIMARY KEY,failures INTEGER NOT NULL,window_start TEXT NOT NULL,locked_until TEXT)",
      "CREATE TABLE IF NOT EXISTS driver_moderators(member_id TEXT PRIMARY KEY REFERENCES driver_accounts(id) ON DELETE CASCADE,granted_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS driver_moderation_state(post_id TEXT PRIMARY KEY REFERENCES driver_posts(id) ON DELETE CASCADE,hidden INTEGER NOT NULL CHECK(hidden IN (0,1)),reviewer_id TEXT NOT NULL REFERENCES driver_accounts(id),updated_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS driver_moderation_decisions(id TEXT PRIMARY KEY,post_id TEXT NOT NULL REFERENCES driver_posts(id),reviewer_id TEXT NOT NULL REFERENCES driver_accounts(id),action TEXT NOT NULL CHECK(action IN ('hide','restore','retain')),reason TEXT NOT NULL,created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS driver_moderation_reviewed_reports(report_id TEXT PRIMARY KEY REFERENCES driver_reports(id),decision_id TEXT NOT NULL REFERENCES driver_moderation_decisions(id))",
      "CREATE TABLE IF NOT EXISTS driver_audit(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,event TEXT NOT NULL,subject_id TEXT,created_at TEXT NOT NULL)"
    ].join(";")+";");
  }
  close():void {this.db.close();}
  register(input:{email:string;password:string;handle:string;displayName:string}):CommunityActor {
    const email=text(input.email,254,5).toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error("Invalid email");
    const handle=text(input.handle,32,2).toLowerCase();
    if(!/^[a-z0-9_]+$/.test(handle))throw Error("Invalid handle");
    const id=randomUUID(),hashed=secret(input.password);
    this.db.prepare("INSERT INTO driver_accounts(id,email,handle,password_hash,display_name,created_at) VALUES(?,?,?,?,?,?)")
      .run(id,email,handle,hashed,text(input.displayName,80),new Date().toISOString());
    this.audit(id,"registered",id);
    return this.byId(id);
  }
  login(email:string,password:string):string {
    const norm=typeof email==="string"?email.trim().toLowerCase():"";
    // Persistent identifier throttling; public deployment additionally needs IP/device controls.
    const key=createHash("sha256").update("driver-auth-v1:"+norm).digest("hex");
    const now=Date.now(),timestamp=new Date(now).toISOString();
    const prior=this.db.prepare("SELECT failures,window_start AS start,locked_until AS locked FROM driver_auth_failures WHERE key_digest=?")
      .get(key) as {failures:number;start:string;locked:string|null}|undefined;
    if(prior?.locked&&prior.locked>timestamp)throw Error("Too many login attempts");
    const account=this.db.prepare("SELECT id,password_hash FROM driver_accounts WHERE email=?")
      .get(norm) as {id:string;password_hash:string}|undefined;
    if(!check(password,account?.password_hash)) {
      const fresh=!prior||now-Date.parse(prior.start)>=15*60*1000;
      const attempts=(fresh?0:prior!.failures)+1;
      this.db.prepare("INSERT INTO driver_auth_failures(key_digest,failures,window_start,locked_until) VALUES(?,?,?,?) ON CONFLICT(key_digest) DO UPDATE SET failures=excluded.failures,window_start=excluded.window_start,locked_until=excluded.locked_until")
        .run(key,attempts,fresh?timestamp:prior!.start,attempts>=5?new Date(now+15*60*1000).toISOString():null);
      throw Error("Invalid credentials");
    }
    this.db.prepare("DELETE FROM driver_auth_failures WHERE key_digest=?").run(key);
    const token=randomBytes(32).toString("base64url");
    this.db.prepare("INSERT INTO driver_sessions(token_digest,member_id,expires_at) VALUES(?,?,?)")
      .run(tokenDigest(token),account!.id,new Date(now+7*86400000).toISOString());
    this.audit(account!.id,"logged_in",account!.id);
    return token;
  }
  actor(token:string):CommunityActor {
    if(typeof token!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error("Unauthorized");
    const row=this.db.prepare("SELECT a.* FROM driver_accounts a JOIN driver_sessions s ON s.member_id=a.id WHERE s.token_digest=? AND s.expires_at>?")
      .get(tokenDigest(token),new Date().toISOString()) as Member|undefined;
    if(!row)throw Error("Unauthorized");
    return redact(row);
  }
  logout(token:string):void {
    const actor=this.actor(token);
    this.db.prepare("DELETE FROM driver_sessions WHERE token_digest=?").run(tokenDigest(token));
    this.audit(actor.id,"logged_out",actor.id);
  }
  updateSettings(token:string,patch:{enabled?:boolean;discoverable?:boolean;crewUpEnabled?:boolean}):CommunityActor {
    const a=this.actor(token);
    for(const v of Object.values(patch))if(typeof v!=="boolean")throw Error("Invalid settings");
    const enabled=patch.enabled??a.socialEnabled;
    const discoverable=enabled&&(patch.discoverable??a.discoverable);
    const crewUp=enabled&&(patch.crewUpEnabled??a.crewUpEnabled);
    this.db.prepare("UPDATE driver_accounts SET social_enabled=?,discoverable=?,crew_up_enabled=? WHERE id=?")
      .run(enabled?1:0,discoverable?1:0,crewUp?1:0,a.id);
    this.audit(a.id,"privacy_updated",a.id);
    return this.byId(a.id);
  }
  updateProfile(token:string,input:{displayName:string;bio:string;region?:string|null}):CommunityActor {
    const a=this.enabled(token);
    if(typeof input.bio!=="string"||input.bio.length>500)throw Error("Invalid bio");
    if(input.region!=null&&input.region.length>80)throw Error("Invalid region");
    this.db.prepare("UPDATE driver_accounts SET display_name=?,bio=?,region=? WHERE id=?")
      .run(text(input.displayName,80),input.bio.trim(),input.region?.trim()||null,a.id);
    return this.byId(a.id);
  }
  discover(token:string):CommunityActor[] {
    const a=this.enabled(token);
    return this.db.prepare("SELECT p.* FROM driver_accounts p WHERE p.id<>? AND p.social_enabled=1 AND p.discoverable=1 AND NOT EXISTS(SELECT 1 FROM driver_blocks b WHERE (b.blocker_id=? AND b.blocked_id=p.id) OR (b.blocker_id=p.id AND b.blocked_id=?)) ORDER BY p.handle LIMIT 100")
      .all(a.id,a.id,a.id).map(x=>redact(x as Member));
  }
  requestFriend(token:string,recipient:string):void {
    const a=this.enabled(token);this.peer(a.id,recipient);
    if(recipient===a.id)throw Error("Cannot friend yourself");
    this.db.prepare("INSERT OR IGNORE INTO driver_friend_requests(requester_id,recipient_id,created_at) VALUES(?,?,?)")
      .run(a.id,recipient,new Date().toISOString());
    this.audit(a.id,"friend_requested",recipient);
  }
  acceptFriend(token:string,sender:string):void {
    const a=this.enabled(token);this.peer(a.id,sender);
    if(!this.db.prepare("SELECT 1 FROM driver_friend_requests WHERE requester_id=? AND recipient_id=?").get(sender,a.id))
      throw Error("No incoming request");
    const [lo,hi]=pair(a.id,sender);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("DELETE FROM driver_friend_requests WHERE requester_id=? AND recipient_id=?").run(sender,a.id);
      this.db.prepare("INSERT OR IGNORE INTO driver_friendships(low_id,high_id,created_at) VALUES(?,?,?)")
        .run(lo,hi,new Date().toISOString());
      this.audit(a.id,"friend_accepted",sender);this.db.exec("COMMIT");
    } catch(e){this.db.exec("ROLLBACK");throw e;}
  }
  block(token:string,target:string):void {
    const a=this.enabled(token);
    if(a.id===target)throw Error("Cannot block self");
    const [lo,hi]=pair(a.id,target);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("INSERT OR IGNORE INTO driver_blocks(blocker_id,blocked_id,created_at) VALUES(?,?,?)").run(a.id,target,new Date().toISOString());
      this.db.prepare("DELETE FROM driver_friendships WHERE low_id=? AND high_id=?").run(lo,hi);
      this.db.prepare("DELETE FROM driver_friend_requests WHERE (requester_id=? AND recipient_id=?) OR (requester_id=? AND recipient_id=?)")
        .run(a.id,target,target,a.id);
      this.audit(a.id,"blocked",target);this.db.exec("COMMIT");
    } catch(e){this.db.exec("ROLLBACK");throw e;}
  }
  publish(token:string,input:{body:string;audience?:"network"|"friends";kind?:"update"|"review"|"recommendation";placeId?:string;rating?:number}):CommunityFeedPost {
    const a=this.enabled(token),body=text(input.body,3000),audience=input.audience??"friends",kind=input.kind??"update";
    if(audience!=="network"&&audience!=="friends")throw Error("Unsupported audience");
    if(!["update","review","recommendation"].includes(kind))throw Error("Invalid kind");
    if(kind==="review"&&(!input.placeId||!Number.isInteger(input.rating)||input.rating!<1||input.rating!>5))
      throw Error("Review needs a place and rating 1-5");
    if(input.placeId&&input.placeId.length>128)throw Error("Invalid place ID");
    const p={id:randomUUID(),authorId:a.id,handle:a.handle,displayName:a.displayName,body,
      audience,kind,placeId:kind==="update"?null:input.placeId??null,rating:kind==="review"?input.rating!:null,
      createdAt:new Date().toISOString()};
    this.db.prepare("INSERT INTO driver_posts(id,author_id,body,audience,kind,place_id,rating,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(p.id,p.authorId,p.body,p.audience,p.kind,p.placeId,p.rating,p.createdAt);
    this.audit(a.id,"posted",p.id);return p;
  }
  feed(token:string,limit=50):CommunityFeedPost[] {
    const a=this.enabled(token);
    if(!Number.isInteger(limit)||limit<1||limit>100)throw Error("Invalid feed limit");
    return this.db.prepare([
      "SELECT p.id,p.author_id AS authorId,u.handle,u.display_name AS displayName,p.body,p.audience,p.kind,p.place_id AS placeId,p.rating,p.created_at AS createdAt",
      "FROM driver_posts p JOIN driver_accounts u ON u.id=p.author_id",
      "WHERE u.social_enabled=1 AND NOT EXISTS(SELECT 1 FROM driver_blocks b WHERE (b.blocker_id=? AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=?))",
      "AND NOT EXISTS(SELECT 1 FROM driver_reports r WHERE r.reporter_id=? AND r.post_id=p.id)",
      "AND NOT EXISTS(SELECT 1 FROM driver_moderation_state m WHERE m.post_id=p.id AND m.hidden=1)",
      "AND (p.author_id=? OR p.audience='network' OR (p.audience='friends' AND EXISTS(",
      "SELECT 1 FROM driver_friendships f WHERE (f.low_id=? AND f.high_id=u.id) OR (f.high_id=? AND f.low_id=u.id))))",
      "ORDER BY p.created_at DESC,p.id DESC LIMIT ?"
    ].join(" ")).all(a.id,a.id,a.id,a.id,a.id,a.id,limit) as CommunityFeedPost[];
  }

  /**
   * Driver reports are personal observations, not independent parking/access
   * verification. A review never modifies provider-verified truck attributes.
   */
  createPlaceReview(token:string,input:{
    placeId:string;amenity:string;rating:number;body:string;
    audience?:"friends"|"network";observedAt?:string|null
  }):CommunityFeedPost {
    this.enabled(token);
    const placeId=text(input.placeId,128);
    if(!/^[A-Za-z0-9:_./-]+$/.test(placeId))throw Error("Invalid place reference");
    const amenities=["showers","parking","fuel","laundry","repairs","restrooms","food","general"];
    if(!amenities.includes(input.amenity))throw Error("Invalid amenity");
    if(!Number.isInteger(input.rating)||input.rating<1||input.rating>5)throw Error("Invalid rating");
    const observedAt=input.observedAt??null;
    if(observedAt!==null){
      if(typeof observedAt!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(observedAt))
        throw Error("Invalid observation date");
      const date=new Date(observedAt+"T00:00:00.000Z");
      if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==observedAt ||
         observedAt>new Date().toISOString().slice(0,10))throw Error("Invalid observation date");
    }
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const post=this.publish(token,{body:input.body,kind:"review",audience:input.audience??"friends",
        placeId,rating:input.rating});
      this.db.prepare("INSERT INTO driver_place_review_details(post_id,amenity,observed_at) VALUES(?,?,?)")
        .run(post.id,input.amenity,observedAt);
      this.db.exec("COMMIT");
      return post;
    }catch(error){this.db.exec("ROLLBACK");throw error;}
  }
  placeReviews(token:string,placeId:string,limit=25):{
    id:string;authorId:string;handle:string;displayName:string;body:string;rating:number;
    amenity:string;observedAt:string|null;createdAt:string;audience:"friends"|"network";
    provenance:"driver_self_report";
  }[] {
    const viewer=this.enabled(token);
    const ref=text(placeId,128);
    if(!Number.isInteger(limit)||limit<1||limit>50)throw Error("Invalid limit");
    return this.db.prepare([
      "SELECT p.id,p.author_id AS authorId,u.handle,u.display_name AS displayName,p.body,p.rating,",
      "d.amenity,d.observed_at AS observedAt,p.created_at AS createdAt,p.audience,d.provenance",
      "FROM driver_posts p JOIN driver_place_review_details d ON d.post_id=p.id JOIN driver_accounts u ON u.id=p.author_id",
      "WHERE p.place_id=? AND p.kind='review' AND u.social_enabled=1",
      "AND NOT EXISTS(SELECT 1 FROM driver_blocks b WHERE (b.blocker_id=? AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=?))",
      "AND NOT EXISTS(SELECT 1 FROM driver_reports r WHERE r.reporter_id=? AND r.post_id=p.id)",
      "AND NOT EXISTS(SELECT 1 FROM driver_moderation_state m WHERE m.post_id=p.id AND m.hidden=1)",
      "AND (p.author_id=? OR p.audience='network' OR (p.audience='friends' AND EXISTS(",
      "SELECT 1 FROM driver_friendships f WHERE (f.low_id=? AND f.high_id=u.id) OR (f.high_id=? AND f.low_id=u.id))))",
      "ORDER BY p.created_at DESC,p.id DESC LIMIT ?"
    ].join(" ")).all(ref,viewer.id,viewer.id,viewer.id,viewer.id,viewer.id,viewer.id,limit) as {
      id:string;authorId:string;handle:string;displayName:string;body:string;rating:number;
      amenity:string;observedAt:string|null;createdAt:string;audience:"friends"|"network";
      provenance:"driver_self_report";
    }[];
  }
  /**
   * Reporting immediately hides the post for its reporter, not everybody.
   * No algorithmic takedowns: review by an authorized moderator is a later gate.
   */
  reportPost(token:string,postId:string,reason:string):{reported:true} {
    const actor=this.enabled(token);
    const p=this.accessiblePost(actor.id,postId);
    if(p.authorId===actor.id)throw Error("Cannot report your own post");
    const reasons=["spam","harassment","unsafe_information","inaccurate_place_info","other"];
    if(!reasons.includes(reason))throw Error("Invalid report reason");
    this.db.prepare("INSERT OR IGNORE INTO driver_reports(id,reporter_id,post_id,reason,created_at) VALUES(?,?,?,?,?)")
      .run(randomUUID(),actor.id,postId,reason,new Date().toISOString());
    this.audit(actor.id,"post_reported",postId);
    return {reported:true};
  }
  /** Both writer and reader are bound to the authenticated actor and current post ACL. */
  private accessiblePost(actorId: string, postId: string): {id: string; authorId: string} {
    if(typeof postId!=="string" || !postId.trim())throw Error("Post ID required");
    const item=this.db.prepare([
      "SELECT p.id,p.author_id AS authorId FROM driver_posts p JOIN driver_accounts u ON u.id=p.author_id",
      "WHERE p.id=? AND u.social_enabled=1",
      "AND NOT EXISTS(SELECT 1 FROM driver_reports r WHERE r.reporter_id=? AND r.post_id=p.id)",
      "AND NOT EXISTS(SELECT 1 FROM driver_moderation_state m WHERE m.post_id=p.id AND m.hidden=1)",
      "AND NOT EXISTS(SELECT 1 FROM driver_blocks b WHERE (b.blocker_id=? AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=?))",
      "AND (p.author_id=? OR p.audience='network' OR (p.audience='friends' AND EXISTS(",
      "SELECT 1 FROM driver_friendships f WHERE (f.low_id=? AND f.high_id=u.id) OR (f.high_id=? AND f.low_id=u.id))))"
    ].join(" ")).get(postId,actorId,actorId,actorId,actorId,actorId,actorId) as {id:string;authorId:string}|undefined;
    if(!item)throw Error("Post not visible");
    return item;
  }
  /** Explicit state avoids duplicate likes from retries/offline sync. */
  setLike(token:string,postId:string,liked:boolean):void {
    const a=this.enabled(token);this.accessiblePost(a.id,postId);
    if(typeof liked!=="boolean")throw Error("Invalid like");
    if(liked) this.db.prepare("INSERT OR IGNORE INTO driver_post_likes(post_id,member_id,created_at) VALUES(?,?,?)")
      .run(postId,a.id,new Date().toISOString());
    else this.db.prepare("DELETE FROM driver_post_likes WHERE post_id=? AND member_id=?").run(postId,a.id);
  }
  setBookmark(token:string,postId:string,saved:boolean):void {
    const a=this.enabled(token);this.accessiblePost(a.id,postId);
    if(typeof saved!=="boolean")throw Error("Invalid bookmark");
    if(saved) this.db.prepare("INSERT OR IGNORE INTO driver_post_bookmarks(post_id,member_id,created_at) VALUES(?,?,?)")
      .run(postId,a.id,new Date().toISOString());
    else this.db.prepare("DELETE FROM driver_post_bookmarks WHERE post_id=? AND member_id=?").run(postId,a.id);
  }
  addComment(token:string,postId:string,body:string,parentId?:string):{
    id:string;postId:string;memberId:string;body:string;parentId:string|null;createdAt:string;
  } {
    const a=this.enabled(token);this.accessiblePost(a.id,postId);
    const clean=text(body,2000);
    if(parentId!==undefined) {
      // Parent must be readable, active and part of the very same post.
      const parent=this.db.prepare([
        "SELECT c.id FROM driver_post_comments c JOIN driver_accounts u ON u.id=c.member_id",
        "WHERE c.id=? AND c.post_id=? AND u.social_enabled=1 AND NOT EXISTS(",
        "SELECT 1 FROM driver_blocks b WHERE (b.blocker_id=? AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=?))"
      ].join(" ")).get(parentId,postId,a.id,a.id);
      if(!parent)throw Error("Parent comment not visible");
    }
    const comment={
      id:randomUUID(),postId,memberId:a.id,body:clean,parentId:parentId??null,
      createdAt:new Date().toISOString()
    };
    this.db.prepare("INSERT INTO driver_post_comments(id,post_id,member_id,parent_id,body,created_at) VALUES(?,?,?,?,?,?)")
      .run(comment.id,comment.postId,comment.memberId,comment.parentId,comment.body,comment.createdAt);
    this.audit(a.id,"commented",postId);
    return comment;
  }
  comments(token:string,postId:string,limit=50):{
    id:string;postId:string;memberId:string;handle:string;body:string;parentId:string|null;createdAt:string;
  }[] {
    const a=this.enabled(token);this.accessiblePost(a.id,postId);
    if(!Number.isInteger(limit)||limit<1||limit>100)throw Error("Invalid limit");
    return this.db.prepare([
      "SELECT c.id,c.post_id AS postId,c.member_id AS memberId,u.handle,c.body,c.parent_id AS parentId,c.created_at AS createdAt",
      "FROM driver_post_comments c JOIN driver_accounts u ON u.id=c.member_id",
      "WHERE c.post_id=? AND u.social_enabled=1 AND NOT EXISTS(",
      "SELECT 1 FROM driver_blocks b WHERE (b.blocker_id=? AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=?))",
      "ORDER BY c.created_at ASC,c.id ASC LIMIT ?"
    ].join(" ")).all(postId,a.id,a.id,limit) as {
      id:string;postId:string;memberId:string;handle:string;body:string;parentId:string|null;createdAt:string;
    }[];
  }
  engagement(token:string,postId:string):{likeCount:number;commentCount:number;likedByMe:boolean;bookmarkedByMe:boolean} {
    const a=this.enabled(token);this.accessiblePost(a.id,postId);
    const likes=this.db.prepare([
      "SELECT COUNT(*) AS count FROM driver_post_likes l JOIN driver_accounts u ON u.id=l.member_id",
      "WHERE l.post_id=? AND u.social_enabled=1 AND NOT EXISTS(SELECT 1 FROM driver_blocks b",
      "WHERE (b.blocker_id=? AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=?))"
    ].join(" ")).get(postId,a.id,a.id) as {count:number};
    const comments=this.db.prepare([
      "SELECT COUNT(*) AS count FROM driver_post_comments c JOIN driver_accounts u ON u.id=c.member_id",
      "WHERE c.post_id=? AND u.social_enabled=1 AND NOT EXISTS(SELECT 1 FROM driver_blocks b",
      "WHERE (b.blocker_id=? AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=?))"
    ].join(" ")).get(postId,a.id,a.id) as {count:number};
    return {
      likeCount:likes.count, commentCount:comments.count,
      likedByMe:!!this.db.prepare("SELECT 1 FROM driver_post_likes WHERE post_id=? AND member_id=?").get(postId,a.id),
      bookmarkedByMe:!!this.db.prepare("SELECT 1 FROM driver_post_bookmarks WHERE post_id=? AND member_id=?").get(postId,a.id)
    };
  }
  /** Only incoming requests addressed to this authenticated, opted-in driver. */
  incomingRequests(token:string):CommunityActor[] {
    const a=this.enabled(token);
    return this.db.prepare([
      "SELECT u.* FROM driver_friend_requests r JOIN driver_accounts u ON u.id=r.requester_id",
      "WHERE r.recipient_id=? AND u.social_enabled=1 AND NOT EXISTS(",
      "SELECT 1 FROM driver_blocks b WHERE (b.blocker_id=? AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=?))",
      "ORDER BY r.created_at DESC LIMIT 100"
    ].join(" ")).all(a.id,a.id,a.id).map(u=>redact(u as Member));
  }
  friends(token:string):CommunityActor[] {
    const a=this.enabled(token);
    return this.db.prepare([
      "SELECT u.* FROM driver_friendships f JOIN driver_accounts u ON u.id=CASE WHEN f.low_id=? THEN f.high_id ELSE f.low_id END",
      "WHERE (f.low_id=? OR f.high_id=?) AND u.social_enabled=1 AND NOT EXISTS(",
      "SELECT 1 FROM driver_blocks b WHERE (b.blocker_id=? AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=?))",
      "ORDER BY u.handle LIMIT 100"
    ].join(" ")).all(a.id,a.id,a.id,a.id,a.id).map(u=>redact(u as Member));
  }
  private byId(id:string):CommunityActor {
    const row=this.db.prepare("SELECT * FROM driver_accounts WHERE id=?").get(id) as Member|undefined;
    if(!row)throw Error("Missing member");
    return redact(row);
  }
  private enabled(token:string):CommunityActor {
    const a=this.actor(token);if(!a.socialEnabled)throw Error("Community is off");return a;
  }
  private peer(a:string,b:string):void {
    const other=this.db.prepare("SELECT social_enabled FROM driver_accounts WHERE id=?").get(b) as {social_enabled:number}|undefined;
    if(!other||other.social_enabled!==1)throw Error("Peer unavailable");
    if(this.db.prepare("SELECT 1 FROM driver_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)")
      .get(a,b,b,a))throw Error("Blocked");
  }
  /** Offline-only role grant. Web app constructs this store WITHOUT the secret. */
  grantModeratorOffline(email:string,key:string):void {
    if(!this.bootstrapHash||typeof key!=="string")throw Error("Offline moderator bootstrap unavailable");
    if(!timingSafeEqual(this.bootstrapHash,createHash("sha256").update(key).digest()))
      throw Error("Offline moderator bootstrap denied");
    const actor=this.db.prepare("SELECT id FROM driver_accounts WHERE email=?")
      .get(text(email,254,5).toLowerCase()) as {id:string}|undefined;
    if(!actor)throw Error("Unknown moderator account");
    this.db.prepare("INSERT OR IGNORE INTO driver_moderators(member_id,granted_at) VALUES(?,?)")
      .run(actor.id,new Date().toISOString());
    this.audit(actor.id,"offline_moderator_granted",actor.id);
  }
  private moderator(token:string):CommunityActor {
    const actor=this.actor(token);
    if(!this.db.prepare("SELECT 1 FROM driver_moderators WHERE member_id=?").get(actor.id))
      throw Error("Forbidden: moderator role required");
    return actor;
  }
  /** Pending report queue includes private post evidence for authorized moderators only. */
  moderationQueue(token:string,limit=50):Array<{
    reportId:string;postId:string;reason:string;createdAt:string;body:string;
    audience:"friends"|"network";reportedHandle:string;authorHandle:string;
  }> {
    this.moderator(token);
    if(!Number.isInteger(limit)||limit<1||limit>100)throw Error("Invalid queue limit");
    return this.db.prepare([
      "SELECT r.id AS reportId,r.post_id AS postId,r.reason,r.created_at AS createdAt,p.body,p.audience,",
      "reporter.handle AS reportedHandle,author.handle AS authorHandle",
      "FROM driver_reports r JOIN driver_posts p ON p.id=r.post_id",
      "JOIN driver_accounts reporter ON reporter.id=r.reporter_id",
      "JOIN driver_accounts author ON author.id=p.author_id",
      "WHERE NOT EXISTS(SELECT 1 FROM driver_moderation_reviewed_reports d WHERE d.report_id=r.id)",
      "ORDER BY r.created_at ASC,r.id ASC LIMIT ?"
    ].join(" ")).all(limit) as Array<{
      reportId:string;postId:string;reason:string;createdAt:string;body:string;
      audience:"friends"|"network";reportedHandle:string;authorHandle:string;
    }>;
  }
  moderatePost(token:string,postId:string,action:"hide"|"restore"|"retain",reason:string):{decisionId:string} {
    const reviewer=this.moderator(token);
    if(!["hide","restore","retain"].includes(action))throw Error("Invalid moderation action");
    const id=text(postId,128),explanation=text(reason,500,8);
    if(!this.db.prepare("SELECT 1 FROM driver_posts WHERE id=?").get(id))throw Error("Post not found");
    const now=new Date().toISOString(),decisionId=randomUUID();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("INSERT INTO driver_moderation_decisions(id,post_id,reviewer_id,action,reason,created_at) VALUES(?,?,?,?,?,?)")
        .run(decisionId,id,reviewer.id,action,explanation,now);
      if(action!=="retain")this.db.prepare("INSERT INTO driver_moderation_state(post_id,hidden,reviewer_id,updated_at) VALUES(?,?,?,?) ON CONFLICT(post_id) DO UPDATE SET hidden=excluded.hidden,reviewer_id=excluded.reviewer_id,updated_at=excluded.updated_at")
        .run(id,action==="hide"?1:0,reviewer.id,now);
      this.db.prepare("INSERT INTO driver_moderation_reviewed_reports(report_id,decision_id) SELECT r.id,? FROM driver_reports r WHERE r.post_id=? AND NOT EXISTS(SELECT 1 FROM driver_moderation_reviewed_reports d WHERE d.report_id=r.id)")
        .run(decisionId,id);
      this.audit(reviewer.id,"moderation_"+action,id);
      this.db.exec("COMMIT");
      return {decisionId};
    }catch(e){this.db.exec("ROLLBACK");throw e;}
  }
  private audit(actor:string,event:string,subject:string):void {
    this.db.prepare("INSERT INTO driver_audit(id,actor_id,event,subject_id,created_at) VALUES(?,?,?,?,?)")
      .run(randomUUID(),actor,event,subject,new Date().toISOString());
  }
}
