import {NextResponse} from "next/server";
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity";
import {createSocialRepository} from "@/lib/social/repository";
import {buildIdentityStudioSnapshot} from "@/lib/social/identity-studio";

export const dynamic = "force-dynamic";

/** Authenticated owner-only, no browser-supplied owner or account IDs. */
export async function GET() {
  try {
    const verifier = await createRequestIdentityVerifier();
    const identity = await verifier.verify({});
    const repository = createSocialRepository();
    const [accounts, observations] = await Promise.all([
      repository.listAccounts(identity.userId),
      repository.listObservations(identity.userId),
    ]);
    const view = await buildIdentityStudioSnapshot({
      verifiedUserId: identity.userId,
      accounts,
      observations,
      asOf: new Date().toISOString(),
    });
    return NextResponse.json({success:true,data:view},{
      headers:{"Cache-Control":"private, no-store, max-age=0"},
    });
  } catch (error) {
    const message=error instanceof Error ? error.message : "Identity Studio unavailable";
    const auth=/owner|auth|session|claims|unauthoriz/i.test(message);
    return NextResponse.json({success:false,error:auth ? "Authentication required" : "Identity Studio unavailable"},{
      status:auth ? 401 : 503,
      headers:{"Cache-Control":"private, no-store, max-age=0"},
    });
  }
}
