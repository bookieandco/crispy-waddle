/** Trucker community: an opt-in domain core, NOT a public unauthenticated API. */
export type Audience = "network" | "friends" | "group";
export type PostKind = "update" | "review" | "recommendation";
export interface SocialSettings {
  memberId: string;
  enabled: boolean;
  discoverable: boolean;
  crewUpEnabled: boolean;
}
export interface DriverSocialProfile {
  memberId: string;
  handle: string;
  displayName: string;
  bio: string;
  region?: string; // voluntary, general region; not GPS
}
export interface DriverSocialPost {
  id: string;
  authorId: string;
  body: string;
  kind: PostKind;
  audience: Audience;
  groupId?: string;
  placeId?: string;
  rating?: number;
  createdAt: string;
}
export interface DriverSocialGroup { id: string; name: string; ownerId: string; private: boolean; }
export interface DriverMeetup {
  id: string; organizerId: string; title: string; region: string;
  publicVenueName: string; startsAt: string; audience: "friends" | "group"; groupId?: string;
}
export interface DriverReport {
  id: string; reporterId: string; postId: string; reason: "spam" | "harassment" | "unsafe" | "other";
}
export class TruckerCommunity {
  private opts = new Map<string, SocialSettings>();
  private profiles = new Map<string, DriverSocialProfile>();
  private friendRequests = new Set<string>();
  private friends = new Set<string>();
  private blocked = new Set<string>();
  private groups = new Map<string, DriverSocialGroup>();
  private groupMembers = new Map<string, Set<string>>();
  private posts: DriverSocialPost[] = [];
  private meetups: DriverMeetup[] = [];
  private reports: DriverReport[] = [];
  private sequence = 0;

  settings(memberId: string): SocialSettings {
    return this.opts.get(memberId) ?? {memberId, enabled:false, discoverable:false, crewUpEnabled:false};
  }
  updateSettings(memberId: string, change: Partial<Omit<SocialSettings,"memberId">>): SocialSettings {
    this.validId(memberId);
    const old = this.settings(memberId);
    const enabled = change.enabled ?? old.enabled;
    const next = {memberId,enabled,
      discoverable:enabled && (change.discoverable ?? old.discoverable),
      crewUpEnabled:enabled && (change.crewUpEnabled ?? old.crewUpEnabled)};
    this.opts.set(memberId,next);
    return next;
  }
  saveProfile(actorId: string, input: Omit<DriverSocialProfile,"memberId">): DriverSocialProfile {
    this.member(actorId);
    this.validText(input.handle,2,32);
    if (!/^[A-Za-z0-9_]+$/.test(input.handle)) throw Error("Invalid handle");
    this.validText(input.displayName,1,80);
    if (input.bio.length>500 || (input.region?.length ?? 0)>80) throw Error("Profile too long");
    const p = {...input,memberId:actorId};this.profiles.set(actorId,p);return p;
  }
  searchProfiles(viewerId: string): DriverSocialProfile[] {
    this.member(viewerId);
    return [...this.profiles.values()].filter(p=>p.memberId!==viewerId &&
      this.settings(p.memberId).enabled && this.settings(p.memberId).discoverable &&
      !this.isBlocked(viewerId,p.memberId));
  }
  requestFriend(actorId: string, recipientId: string): void {
    this.both(actorId,recipientId);
    if(actorId===recipientId) throw Error("Self-friending is not allowed");
    this.friendRequests.add(actorId+":"+recipientId);
  }
  acceptFriend(actorId: string, senderId: string): void {
    this.both(actorId,senderId);
    if(!this.friendRequests.delete(senderId+":"+actorId)) throw Error("No pending request");
    this.friends.add(this.pair(actorId,senderId));
  }
  block(actorId: string, targetId: string): void {
    this.member(actorId);this.validId(targetId);
    if(actorId===targetId) throw Error("Cannot block self");
    this.blocked.add(actorId+":"+targetId);
    this.friends.delete(this.pair(actorId,targetId));
    this.friendRequests.delete(actorId+":"+targetId);
    this.friendRequests.delete(targetId+":"+actorId);
  }
  createGroup(actorId:string,id:string,name:string,isPrivate=false):DriverSocialGroup {
    this.member(actorId);this.validId(id);this.validText(name,2,80);
    if(this.groups.has(id)) throw Error("Duplicate group");
    const g={id,name,ownerId:actorId,private:isPrivate};this.groups.set(id,g);
    this.groupMembers.set(id,new Set([actorId]));return g;
  }
  joinGroup(actorId:string,groupId:string):void {
    this.member(actorId);
    const group=this.groups.get(groupId);
    if(!group || group.private) throw Error("Invitation required");
    this.groupMembers.get(groupId)!.add(actorId);
  }
  inviteToGroup(actorId:string,inviteeId:string,groupId:string):void {
    const group=this.groups.get(groupId);
    if(!group || group.ownerId!==actorId) throw Error("Owner approval required");
    this.both(actorId,inviteeId);
    this.groupMembers.get(groupId)!.add(inviteeId);
  }
  post(actorId:string,input:{
    body:string;kind?:PostKind;audience?:Audience;groupId?:string;placeId?:string;rating?:number;
  }):DriverSocialPost {
    this.member(actorId);this.validText(input.body,1,3000);
    const audience=input.audience??"friends";
    if(audience==="group" && (!input.groupId||!this.groupMembers.get(input.groupId)?.has(actorId))) {
      throw Error("Group membership required");
    }
    const kind=input.kind??"update";
    if(kind==="review" && (!input.placeId||!Number.isInteger(input.rating)||
      input.rating!<1||input.rating!>5)) throw Error("Review needs a place and 1-5 stars");
    const item:DriverSocialPost={
      id:this.id("post"),authorId:actorId,body:input.body.trim(),kind,audience,
      groupId:audience==="group"?input.groupId:undefined,
      placeId:kind==="review"||kind==="recommendation"?input.placeId:undefined,
      rating:kind==="review"?input.rating:undefined,createdAt:new Date().toISOString()
    };
    this.posts.push(item);return item;
  }
  feed(viewerId:string):DriverSocialPost[] {
    this.member(viewerId);
    return this.posts.filter(p=>this.visible(viewerId,p)).slice().reverse();
  }
  makeMeetup(actorId:string,input:{
    title:string;region:string;publicVenueName:string;startsAt:string;
    audience:"friends"|"group";groupId?:string;
  }):DriverMeetup {
    this.member(actorId);
    this.validText(input.title,2,120);this.validText(input.region,2,80);
    this.validText(input.publicVenueName,2,120);
    if(!Number.isFinite(Date.parse(input.startsAt))||Date.parse(input.startsAt)<=Date.now()) {
      throw Error("Future meetup time required");
    }
    if(input.audience==="group" && (!input.groupId||!this.groupMembers.get(input.groupId)?.has(actorId))) {
      throw Error("Group membership required");
    }
    const m={...input,id:this.id("meetup"),organizerId:actorId};
    this.meetups.push(m);return m;
  }
  browseMeetups(viewerId:string):DriverMeetup[] {
    this.member(viewerId);
    return this.meetups.filter(m=>this.settings(m.organizerId).enabled && !this.isBlocked(viewerId,m.organizerId) &&
      (viewerId===m.organizerId || (m.audience==="friends" && this.friends.has(this.pair(viewerId,m.organizerId))) ||
       (m.audience==="group" && !!m.groupId && this.groupMembers.get(m.groupId)?.has(viewerId))));
  }
  report(viewerId:string,postId:string,reason:DriverReport["reason"]):DriverReport {
    this.member(viewerId);
    const p=this.posts.find(p=>p.id===postId);
    if(!p||!this.visible(viewerId,p)) throw Error("Cannot report inaccessible content");
    const report={id:this.id("report"),reporterId:viewerId,postId,reason};
    this.reports.push(report);return report;
  }
  private visible(viewer:string,post:DriverSocialPost):boolean {
    if(!this.settings(post.authorId).enabled||this.isBlocked(viewer,post.authorId))return false;
    if(viewer===post.authorId||post.audience==="network")return true;
    if(post.audience==="friends")return this.friends.has(this.pair(viewer,post.authorId));
    return !!post.groupId&&!!this.groupMembers.get(post.groupId)?.has(viewer);
  }
  private both(a:string,b:string):void {
    this.member(a);this.member(b);
    if(this.isBlocked(a,b))throw Error("Connection blocked");
  }
  private member(id:string):void {
    this.validId(id);if(!this.settings(id).enabled)throw Error("Social participation is off");
  }
  private validId(id:string):void {
    if(typeof id!=="string"||!id.trim())throw Error("ID required");
  }
  private validText(value:string,min:number,max:number):void {
    if(typeof value!=="string"||value.trim().length<min||value.length>max)throw Error("Invalid text");
  }
  private isBlocked(a:string,b:string):boolean {
    return this.blocked.has(a+":"+b)||this.blocked.has(b+":"+a);
  }
  private pair(a:string,b:string):string {return [a,b].sort().join(":");}
  private id(prefix:string):string {return prefix+"_"+String(++this.sequence).padStart(6,"0");}
}
