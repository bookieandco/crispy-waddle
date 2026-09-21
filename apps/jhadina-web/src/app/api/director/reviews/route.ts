import { NextResponse } from 'next/server';
import { applyDirectorReviewTransition, commitDirectorMediaReview } from '@jhadina/director-core';
import { SupabaseDirectorReviewTransitionRepository, type DirectorReviewTransitionClient } from '@/lib/director-review-transition-repository';
import { createConfiguredDirectorGenerationRuntime } from '@/lib/director-generation-composition';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
export const runtime='nodejs'; export const dynamic='force-dynamic';
type Body={projectId:string;runId:string;gateId:string;generationStageId:string;reviewStageId:string;assetId:string;decision:'approved'|'changes_requested'|'rejected';note?:string;decisionId:string;decidedBy:string};
function valid(x:unknown):x is Body{if(!x||typeof x!=='object')return false;const b=x as Partial<Body>;return ['projectId','runId','gateId','generationStageId','reviewStageId','assetId','decisionId','decidedBy'].every(k=>typeof (b as any)[k]==='string')&&['approved','changes_requested','rejected'].includes(String(b.decision));}
export async function POST(req:Request){
 const secret=process.env.DIRECTOR_API_SECRET;if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({ok:false},{status:401});
 let raw:unknown;try{raw=await req.json();}catch{return NextResponse.json({ok:false,error:'DIRECTOR_INVALID_JSON'},{status:400});}if(!valid(raw))return NextResponse.json({ok:false,error:'DIRECTOR_INVALID_REVIEW_REQUEST'},{status:400});
 const client=createServiceRoleClient();if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED'},{status:503});
 try{const rt=await createConfiguredDirectorGenerationRuntime(client);const authority=await rt.reviewAuthority.resolve(raw);const decision=await commitDirectorMediaReview({authority,decision:raw.decision,decisionId:raw.decisionId,decidedBy:raw.decidedBy,note:raw.note,repository:rt.reviewRepository});const transition=await applyDirectorReviewTransition(decision,new SupabaseDirectorReviewTransitionRepository(client as unknown as DirectorReviewTransitionClient));return NextResponse.json({ok:true,decision,transition},{status:201});}
 catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'DIRECTOR_REVIEW_FAILED'},{status:409});}
}
