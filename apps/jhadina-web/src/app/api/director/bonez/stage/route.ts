import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
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

function oidcToken():string|undefined{
  return process.env.VERCEL_OIDC_TOKEN?.trim()||undefined;
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
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({ok:false,error:'Authentication required'},{status:401});

  const oidc=oidcToken();
  if(!oidc) return NextResponse.json({ok:false,error:'DIRECTOR_VERCEL_OIDC_REQUIRED'},{status:503});

  let form:FormData;
  try{form=await request.formData();}
  catch{return NextResponse.json({ok:false,error:'Expected multipart/form-data'},{status:400});}

  try{
    const [characterBytes,productBytes]=await Promise.all([
      readExpectedJpeg(form.get('characterFile'),BONEZ_REFERENCE_SHA256,'character'),
      readExpectedJpeg(form.get('productFile'),BONEZ_PRODUCT_REFERENCE_SHA256,'product'),
    ]);

    const staged=await fetch(GATEWAY_URL,{
      method:'POST',
      headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json'},
      body:JSON.stringify({
        action:'stage',
        userId:user.id,
        characterBase64:Buffer.from(characterBytes).toString('base64'),
        productBase64:Buffer.from(productBytes).toString('base64'),
      }),
      cache:'no-store',
    });
    const stagedBody=await staged.json().catch(()=>({ok:false,error:'DIRECTOR_BONEZ_STAGE_INVALID_JSON'})) as Record<string,unknown>;
    if(!staged.ok){
      return NextResponse.json(stagedBody,{status:staged.status,headers:{'cache-control':'no-store'}});
    }

    const token=typeof stagedBody.token==='string'?stagedBody.token:'';
    if(!token) return NextResponse.json({ok:false,error:'DIRECTOR_BONEZ_STAGE_TOKEN_MISSING'},{status:502});

    const bootstrapUrl=new URL('/api/director/bonez/bootstrap',request.url);
    bootstrapUrl.searchParams.set('token',token);
    const completed=await fetch(bootstrapUrl,{
      method:'GET',
      headers:{'x-vercel-oidc-token':oidc},
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
