import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { reconcileDirectorProcessReplicationJobs } from '@/lib/director-process-replication-reconciler';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`){
    return NextResponse.json({ok:false},{status:401});
  }
  const client=createServiceRoleClient();
  if(!client) return NextResponse.json({ok:false,error:'DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED'},{status:503});
  const result=await reconcileDirectorProcessReplicationJobs(client,{limit:10});
  return NextResponse.json({ok:true,...result});
}
