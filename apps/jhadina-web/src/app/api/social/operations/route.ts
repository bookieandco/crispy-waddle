import {NextResponse} from "next/server";
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity";
import {buildSocialOperationsSnapshot} from "@/lib/social/social-operations-dashboard";

export const dynamic="force-dynamic";
/**
 * Read-only operational shell.
 *
 * A real trusted .23 owner-scoped report + canonical receipt read has NOT
 * been commissioned. Never assemble this view using browser-supplied records,
 * test fixtures or generic outbox rows. In particular, an environment flag
 * does not establish that missing SQL/RLS/restore requirements have passed.
 */
export async function GET() {
  try {
    const verifier=await createRequestIdentityVerifier();
    const owner=await verifier.verify({});
    if(!owner.userId?.trim())throw new Error("SOCIAL_OPS_AUTH_REQUIRED");
    if(process.env.JHADINA_SOCIAL_WEEKLY_AUDIT_READ_ENABLED==="true"){
      // Safest possible behavior until canonical weekly packet/review readers
      // are independently commissioned: explicit failure, not fake zero rows.
      return NextResponse.json({
        success:false,error:"Weekly operations source is not commissioned.",
      },{status:503,headers:{"Cache-Control":"private, no-store, max-age=0"}});
    }
    const view=buildSocialOperationsSnapshot({
      verifiedOwnerUserId:owner.userId,
      asOf:new Date().toISOString(),readiness:"NOT_COMMISSIONED",
    });
    return NextResponse.json({success:true,data:view},{
      headers:{"Cache-Control":"private, no-store, max-age=0"},
    });
  } catch {
    return NextResponse.json({success:false,error:"Authentication required"},{
      status:401,headers:{"Cache-Control":"private, no-store, max-age=0"},
    });
  }
}
