import {NextResponse} from "next/server"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"
import {createMoneyPlaidLinkToken} from "@/lib/money/bank-link-runtime"
export async function POST(){try{const verifier=await createRequestIdentityVerifier();const identity=await verifier.verify({});const token=await createMoneyPlaidLinkToken(identity.userId);return NextResponse.json({success:true,data:token})}catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Link token failed"},{status:403})}}
