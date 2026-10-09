import { NextRequest, NextResponse } from "next/server";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { runReviewedVocalRegionRender } from "@/lib/music/restoration-reviewed-vocals-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { ReviewedVocalRegionRole } from "@jhadina/music-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const roles = new Set([
  "lead","backing","double","harmony","ad-lib","spoken",
  "shout","response","effect","breath",
]);

function reply(data: unknown, status: number) {
  return NextResponse.json(data,{status,headers:{"cache-control":"private, no-store"}});
}

export async function POST(request: NextRequest) {
  const claimed = request.headers.get("x-jhadina-user-id")?.trim() ?? "";
  if (!claimed) return reply({success:false,error:"Not signed in"},401);
  try {
    const identity = await (await createRequestIdentityVerifier()).verify({userId:claimed});
    const json = await request.json() as {
      caseId?:unknown; parentArtifactId?:unknown;
      regions?:unknown;
    };
    const caseId=typeof json.caseId==="string"?json.caseId.trim():"";
    const parentArtifactId=typeof json.parentArtifactId==="string"?json.parentArtifactId.trim():"";
    if (!caseId || !parentArtifactId || caseId.length>240 || parentArtifactId.length>240 ||
        !Array.isArray(json.regions) || json.regions.length<1 || json.regions.length>64) {
      return reply({success:false,error:"Case, vocal stem and 1–64 reviewed regions are required"},400);
    }
    const regions = json.regions.map((item: unknown)=>{
      const r=item as {role?:unknown;startMs?:unknown;endMs?:unknown};
      if (!r || typeof r!=="object" || typeof r.role!=="string" ||
          !roles.has(r.role) || typeof r.startMs!=="number" || typeof r.endMs!=="number" ||
          !Number.isFinite(r.startMs) || !Number.isFinite(r.endMs)) {
        throw new Error("MUSIC_VOCAL_REGIONS_BOUNDARIES_INVALID");
      }
      return {role:r.role as ReviewedVocalRegionRole,startMs:r.startMs,endMs:r.endMs};
    });
    const client=createServiceRoleClient();
    if (!client) throw new Error("MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED");
    const result=await runReviewedVocalRegionRender({
      client,ownerUserId:identity.userId,caseId,parentArtifactId,regions,
    });
    return reply({success:true,...result},200);
  } catch(error) {
    const message=error instanceof Error?error.message:"Reviewed vocal region render unavailable";
    const status=/identity|session|signed in/i.test(message)?401
      : /REQUIRED/.test(message)?404
      : /NOT_CONFIGURED|not commissioned|UNAVAILABLE/i.test(message)?503:422;
    return reply({success:false,error:message},status);
  }
}
