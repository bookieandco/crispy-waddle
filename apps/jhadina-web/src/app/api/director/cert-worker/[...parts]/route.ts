import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { loadDirectorRuntimeConfig } from '@/lib/director-runtime-config';
import { createDirectorCertificationMp4 } from '@/lib/director-certification-mp4';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');

function providerJobId(key:string,sourceJobId:string,duration:number):string {
  const digest=createHash('sha256').update(key+'|'+sourceJobId+'|'+duration).digest('hex').slice(0,16);
  return 'cert-'+Math.round(duration)+'-'+digest;
}

function durationFromJobId(id:string):number {
  const match=/^cert-(\d{1,4})-[a-f0-9]{16}$/.exec(id);
  const duration=match?Number(match[1]):NaN;
  if(!Number.isFinite(duration)||duration<1||duration>3600) throw new Error('DIRECTOR_CERT_PROVIDER_JOB_ID_INVALID');
  return duration;
}

async function authorized(request:Request):Promise<boolean> {
  const client=createServiceRoleClient();
  if(!client) return false;
  const config=await loadDirectorRuntimeConfig(client);
  const token=config.certificationVideoProviderToken;
  return Boolean(token && request.headers.get('authorization')==='Bearer '+token);
}

export async function POST(request:Request,{params}:{params:Promise<{parts:string[]}>}) {
  const {parts}=await params;
  if(parts.length!==1||parts[0]!=='jobs') return NextResponse.json({error:'not found'},{status:404});
  if(!(await authorized(request))) return NextResponse.json({error:'unauthorized'},{status:401});
  const body=await request.json() as {jobId?:string;projectId?:string;prompt?:string;intent?:{targetDurationSeconds?:number}};
  const duration=Math.round(Number(body.intent?.targetDurationSeconds??30));
  if(!body.jobId||!body.projectId||!body.prompt||!Number.isFinite(duration)||duration<1||duration>3600) {
    return NextResponse.json({error:'DIRECTOR_CERT_VIDEO_FIELDS_INVALID'},{status:400});
  }
  const id=providerJobId(request.headers.get('idempotency-key')??body.jobId,body.jobId,duration);
  return NextResponse.json({
    providerJobId:id,
    status:'ready',
    metadata:{requestedDurationSeconds:duration,durationSeconds:duration,renderer:'mp4-timing-smoke',qualityClaim:false},
  });
}

export async function GET(request:Request,{params}:{params:Promise<{parts:string[]}>}) {
  const {parts}=await params;
  if(parts.length===1&&parts[0]==='health') {
    return NextResponse.json({ok:true,service:'jhadina-director-cert-worker',renderer:'mp4-timing-smoke',qualityClaim:false});
  }
  if(parts.length===1&&parts[0]==='reference') {
    return new Response(PNG,{headers:{'content-type':'image/png','cache-control':'public, max-age=31536000, immutable'}});
  }
  if(!(await authorized(request))) return NextResponse.json({error:'unauthorized'},{status:401});
  if(parts.length===2&&parts[0]==='jobs') {
    const id=parts[1]!;
    const duration=durationFromJobId(id);
    return NextResponse.json({
      providerJobId:id,
      status:'ready',
      resultUri:'/api/director/cert-worker/jobs/'+encodeURIComponent(id)+'/output',
      metadata:{durationSeconds:duration,renderer:'mp4-timing-smoke',qualityClaim:false},
    });
  }
  if(parts.length===3&&parts[0]==='jobs'&&parts[2]==='output') {
    const duration=durationFromJobId(parts[1]!);
    const bytes=createDirectorCertificationMp4(duration);
    return new Response(bytes,{
      headers:{
        'content-type':'video/mp4',
        'content-length':String(bytes.byteLength),
        'cache-control':'private, no-store',
        'x-director-cert-duration':String(duration),
        'x-director-cert-quality-claim':'false',
      },
    });
  }
  return NextResponse.json({error:'not found'},{status:404});
}

export async function DELETE(request:Request,{params}:{params:Promise<{parts:string[]}>}) {
  const {parts}=await params;
  if(!(await authorized(request))) return NextResponse.json({error:'unauthorized'},{status:401});
  if(parts.length!==2||parts[0]!=='jobs') return NextResponse.json({error:'not found'},{status:404});
  durationFromJobId(parts[1]!);
  return NextResponse.json({ok:true,cancelled:true});
}
