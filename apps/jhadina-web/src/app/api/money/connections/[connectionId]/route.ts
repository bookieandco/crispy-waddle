import {NextRequest,NextResponse} from "next/server"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"
import {disconnectMoneyBankConnection} from "@/lib/money/bank-link-runtime"
export async function DELETE(_request:NextRequest,{params}:{params:{connectionId:string}}){try{const verifier=await createRequestIdentityVerifier();await verifier.verify({});await disconnectMoneyBankConnection(params.connectionId);return NextResponse.json({success:true})}catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Disconnect failed"},{status:403})}}
