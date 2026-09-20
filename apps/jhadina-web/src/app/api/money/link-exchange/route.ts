import {NextRequest,NextResponse} from "next/server"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"
import {exchangeMoneyPlaidPublicToken} from "@/lib/money/bank-link-runtime"
export async function POST(request:NextRequest){try{const verifier=await createRequestIdentityVerifier();await verifier.verify({});const body=await request.json() as {publicToken?:string};const result=await exchangeMoneyPlaidPublicToken(body.publicToken??"");return NextResponse.json({success:true,data:result})}catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Bank connection failed"},{status:403})}}
