import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceRoleClient} from '@/lib/supabase/service-role';
import {
  buildBonezGatewayCanonicalPayload,
  stageBonezReferenceDerivatives,
} from '@/lib/director-bonez-live-inputs';
import {
  DIRECTOR_REFERENCE_MAX_BYTES,
  inspectDirectorReferenceImage,
} from '@/lib/director-reference-media';
import {
  BONEZ_PRODUCT_REFERENCE_SHA256,
  BONEZ_REFERENCE_SHA256,
} from '@/lib/director-bonez-canon';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;

const GATEWAY_URL='https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway';

function hash(bytes:Uint8Array):string{
  return createHash('sha256').update(bytes).digest('hex');
}

function oidcToken(request:Request):string|undefined{
  return process.env.VERCEL_OIDC_TOKEN?.trim()||
    request.headers.get('x-vercel-oidc-token')?.trim()||
    undefined;
}

async function readExpectedJpeg(file:FormDataEntryValue|null,expectedSha:string,label:string){
  if(!(file instanceof File)) throw new Error(`DIRECTOR_BONEZ_${label.toUpperCase()}_FILE_REQUIRED`);
  if(file.size<=0||file.size>DIRECTOR_REFERENCE_MAX_BYTES){
    throw new Error(`DIRECTOR_BONEZ_${label.toUpperCase()}_FILE_SIZE_INVALID`);
  }
  const bytes=new Uint8Array(await file.arrayBuffer());
  inspectDirectorReferenceImage(bytes,file.type||'image/jpeg');
  const actual=hash(bytes);
  if(actual!==expectedSha){
    throw new Error(`DIRECTOR_BONEZ_REFERENCE_SHA_MISMATCH:${label}:${actual}`);
  }
  return bytes;
}

export async function POST(request:Request){
  const supabase=await createClient();
  const [{data:{user}},{data:{session}}]=await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  if(!user) return NextResponse.json({ok:false,error:'Authentication required'},{status:401});

  const oidc=oidcToken(request);
  const userAccessToken=session?.access_token?.trim()||undefined;
  const privileged=createServiceRoleClient();
  const gatewayAuth=oidc||userAccessToken;
  if(!privileged&&!gatewayAuth){
    return NextResponse.json({ok:false,error:'DIRECTOR_PRIVILEGED_OR_USER_SESSION_REQUIRED'},{status:503});
  }

  let form:FormData;
  try{form=await request.formData();}
  catch{return NextResponse.json({ok:false,error:'Expected multipart/form-data'},{status:400});}

  try{
    const [characterBytes,productBytes]=await Promise.all([
      readExpectedJpeg(form.get('characterFile'),BONEZ_REFERENCE_SHA256,'character'),
      readExpectedJpeg(form.get('productFile'),BONEZ_PRODUCT_REFERENCE_SHA256,'product'),
    ]);

    let stagedBody:Record<string,unknown>;
    if(privileged){
      stagedBody=await stageBonezReferenceDerivatives(privileged,{
        userId:user.id,
        characterBytes,
        productBytes,
      }) as unknown as Record<string,unknown>;
    }else{
      const staged=await fetch(GATEWAY_URL,{
        method:'POST',
        headers:{authorization:`Bearer ${gatewayAuth}`,'content-type':'application/json'},
        body:JSON.stringify({
          action:'stage',
          userId:user.id,
          characterBase64:Buffer.from(characterBytes).toString('base64'),
          productBase64:Buffer.from(productBytes).toString('base64'),
        }),
        cache:'no-store',
      });
      stagedBody=await staged.json().catch(()=>({ok:false,error:'DIRECTOR_BONEZ_STAGE_INVALID_JSON'})) as Record<string,unknown>;
      if(!staged.ok){
        return NextResponse.json(stagedBody,{status:staged.status,headers:{'cache-control':'no-store'}});
      }
    }

    const token=typeof stagedBody.token==='string'?stagedBody.token:'';
    if(!token) return NextResponse.json({ok:false,error:'DIRECTOR_BONEZ_STAGE_TOKEN_MISSING'},{status:502});

    if(!privileged&&!oidc){
      return NextResponse.json({
        ...stagedBody,
        machineBootstrapRequired:true,
        privilegedTransport:'supabase-user-jwt-edge',
        next:'DIRECTOR-QUALITY.2-MACHINE-BOOTSTRAP',
      },{
        status:202,
        headers:{'cache-control':'no-store','referrer-policy':'no-referrer'},
      });
    }

    if(privileged){
      const bootstrapUrl=new URL('/api/director/bonez/bootstrap',request.url);
      bootstrapUrl.searchParams.set('token',token);
      const completed=await fetch(bootstrapUrl,{method:'GET',cache:'no-store'});
      const completedBody=await completed.json().catch(()=>({ok:false,error:'DIRECTOR_BONEZ_BOOTSTRAP_INVALID_JSON'}));
      return NextResponse.json(completedBody,{
        status:completed.status,
        headers:{'cache-control':'no-store','referrer-policy':'no-referrer'},
      });
    }

    const completed=await fetch(GATEWAY_URL,{
      method:'POST',
      headers:{authorization:`Bearer ${gatewayAuth}`,'content-type':'application/json'},
      body:JSON.stringify({
        action:'bootstrap',
        token,
        canonical:buildBonezGatewayCanonicalPayload(new Date().toISOString(),user.id),
      }),
      cache:'no-store',
    });
    const completedBody=await completed.json().catch(()=>({ok:false,error:'DIRECTOR_BONEZ_BOOTSTRAP_INVALID_JSON'}));
    return NextResponse.json(completedBody,{
      status:completed.status,
      headers:{'cache-control':'no-store','referrer-policy':'no-referrer'},
    });
  }catch(cause){
    const message=cause instanceof Error?cause.message:'DIRECTOR_BONEZ_STAGE_FAILED';
    const status=message.includes('REQUIRED')||message.includes('SIZE_INVALID')?400:
      message.includes('SHA_MISMATCH')?409:500;
    return NextResponse.json({ok:false,error:message},{status,headers:{'cache-control':'no-store'}});
  }
}
