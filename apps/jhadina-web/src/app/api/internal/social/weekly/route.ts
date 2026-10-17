import {NextRequest,NextResponse} from "next/server";
import {authorizedSchedulerRequest} from "@/lib/internal-scheduler-auth";
import {createSchedulerServiceRoleClient} from "@/lib/supabase/service-role";
import {createWeeklySocialRuntimeRepository} from "@/lib/social/weekly-runtime-repository";
import {
  createUncommissionedWeeklySocialHandlers,
  runProtectedWeeklySocialWorker,
} from "@/lib/social/weekly-production-worker";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

async function run(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request))){
    return NextResponse.json({ok:false,error:"unauthorized"},{status:401});
  }
  const client=createSchedulerServiceRoleClient(request);
  if(!client){
    return NextResponse.json({
      ok:false,
      error:"SOCIAL_WEEKLY_SCHEDULER_STORAGE_UNAVAILABLE",
      executionReady:false,
    },{status:503,headers:{"cache-control":"no-store"}});
  }

  const rawOwnerLimit=Number(request.nextUrl.searchParams.get("ownerLimit")??50);
  const rawActionLimit=Number(
    request.nextUrl.searchParams.get("actionLimitPerOwner")??25,
  );
  const ownerLimit=Number.isInteger(rawOwnerLimit)&&rawOwnerLimit>=1&&rawOwnerLimit<=200
    ? rawOwnerLimit
    : 50;
  const actionLimitPerOwner=
    Number.isInteger(rawActionLimit)&&rawActionLimit>=1&&rawActionLimit<=100
      ? rawActionLimit
      : 25;

  try{
    const repository=createWeeklySocialRuntimeRepository(client);
    const handlers=createUncommissionedWeeklySocialHandlers();
    const receipt=await runProtectedWeeklySocialWorker({
      repository,
      handlers,
      ownerLimit,
      actionLimitPerOwner,
    });
    const executionReady=receipt.handlerCoverageComplete;
    return NextResponse.json({
      ok:true,
      executionReady,
      mode:executionReady?"dispatch_ready":"admission_only",
      receipt,
      blocker:executionReady
        ? null
        : "SOCIAL_WEEKLY_RUNTIME_HANDLERS_NOT_COMMISSIONED",
    },{headers:{"cache-control":"no-store"}});
  }catch(error){
    return NextResponse.json({
      ok:false,
      executionReady:false,
      error:error instanceof Error?error.message:String(error),
    },{status:503,headers:{"cache-control":"no-store"}});
  }
}

export async function GET(request:NextRequest){return run(request);}
export async function POST(request:NextRequest){return run(request);}
