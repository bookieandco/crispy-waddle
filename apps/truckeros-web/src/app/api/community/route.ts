import { NextRequest, NextResponse } from "next/server";
import { apiEnabled, assertSafeMutation, clearSession, database, failure, readPayload, response, session, setSession } from "@/lib/communityServer";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
const s=(x:unknown)=>typeof x==="string"?x:"";
export async function GET(request:NextRequest) {
  try {
    if(!apiEnabled())return failure(Error("Community preview not enabled"));
    const db=database(),token=session(request),actor=db.actor(token);
    return response({
      actor,
      feed:actor.socialEnabled?db.feed(token):[],
      discoverable:actor.socialEnabled?db.discover(token):[],
      incoming:actor.socialEnabled?db.incomingRequests(token):[],
      friends:actor.socialEnabled?db.friends(token):[]
    });
  } catch(e){return failure(e);}
}
export async function POST(request:NextRequest) {
  try {
    assertSafeMutation(request);
    const p=await readPayload(request);
    const db=database(),action=s(p.action);
    if(action==="register"||action==="login") {
      // Local preview only. Do NOT expose account signup on a production host.
      if(action==="register") db.register({email:s(p.email),password:s(p.password),handle:s(p.handle),displayName:s(p.displayName)});
      const token=db.login(s(p.email),s(p.password));
      const res=response({actor:db.actor(token)});
      return setSession(res,token);
    }
    const token=session(request);db.actor(token);
    if(action==="logout") {
      db.logout(token);
      return clearSession(response({loggedOut:true}));
    }
    if(action==="settings")return response({actor:db.updateSettings(token,{
      enabled:p.enabled as boolean|undefined,discoverable:p.discoverable as boolean|undefined,
      crewUpEnabled:p.crewUpEnabled as boolean|undefined
    })});
    if(action==="profile")return response({actor:db.updateProfile(token,{
      displayName:s(p.displayName),bio:s(p.bio),region:p.region===null?null:s(p.region)
    })});
    if(action==="post")return response({post:db.publish(token,{
      body:s(p.body),audience:p.audience as "network"|"friends"|undefined,
      kind:p.kind as "update"|"review"|"recommendation"|undefined,placeId:p.placeId===undefined?undefined:s(p.placeId),
      rating:p.rating as number|undefined
    })},201);
    if(action==="friendRequest"){db.requestFriend(token,s(p.memberId));return response({accepted:true});}
    if(action==="acceptFriend"){db.acceptFriend(token,s(p.memberId));return response({accepted:true});}
    if(action==="block"){db.block(token,s(p.memberId));return response({accepted:true});}
    if(action==="like"){db.setLike(token,s(p.postId),p.liked as boolean);return response({engagement:db.engagement(token,s(p.postId))});}
    if(action==="bookmark"){db.setBookmark(token,s(p.postId),p.saved as boolean);return response({engagement:db.engagement(token,s(p.postId))});}
    if(action==="comment"){const comment=db.addComment(token,s(p.postId),s(p.body),p.parentId===undefined?undefined:s(p.parentId));return response({comment},201);}
    if(action==="comments"){const postId=s(p.postId);return response({comments:db.comments(token,postId),engagement:db.engagement(token,postId)});}
    throw Error("Unknown action");
  } catch(e){return failure(e);}
}
