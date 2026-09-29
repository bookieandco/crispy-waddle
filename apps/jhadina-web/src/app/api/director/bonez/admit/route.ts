import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {inspectDirectorReferenceImage,DIRECTOR_REFERENCE_MAX_BYTES} from '@/lib/director-reference-media';
import {
  BONEZ_CHARACTER_ID,
  BONEZ_ORIGINAL_UPLOAD_SHA256,
  BONEZ_PRODUCT_REFERENCE_ASSET_ID,
  BONEZ_PRODUCT_REFERENCE_SHA256,
  BONEZ_PROJECT_ID,
  BONEZ_REFERENCE_ASSET_ID,
  BONEZ_REFERENCE_SHA256,
  BONEZ_RIGHTS_REF,
  bonezAssetPackages,
  bonezCastRecord,
  bonezCreativeDirectives,
  bonezProductBible,
  bonezWorldState,
} from '@/lib/director-bonez-canon';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;

const DEFAULT_BONEZ_GATEWAY_URL=
  'https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway';
const MAX_DIRECT_FILE_BYTES=2_000_000;
const MAX_DIRECT_COMBINED_BYTES=3_000_000;

function sha256(bytes:Uint8Array){
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalPayload(now:string,userId:string){
  return {
    projectId:BONEZ_PROJECT_ID,
    characterId:BONEZ_CHARACTER_ID,
    rightsRef:BONEZ_RIGHTS_REF,
    originalUploadSha256:BONEZ_ORIGINAL_UPLOAD_SHA256,
    references:{
      character:{assetId:BONEZ_REFERENCE_ASSET_ID,expectedSha:BONEZ_REFERENCE_SHA256},
      product:{assetId:BONEZ_PRODUCT_REFERENCE_ASSET_ID,expectedSha:BONEZ_PRODUCT_REFERENCE_SHA256},
    },
    cast:bonezCastRecord(now,userId),
    packages:bonezAssetPackages(now),
    world:bonezWorldState(now),
    directives:bonezCreativeDirectives(now),
    productBible:bonezProductBible(),
  };
}

function oidcToken(request:Request){
  return process.env.VERCEL_OIDC_TOKEN?.trim()||
    request.headers.get('x-vercel-oidc-token')?.trim()||
    undefined;
}

function fileFrom(form:FormData,name:string){
  const value=form.get(name);
  return value instanceof File?value:undefined;
}

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({ok:false,error:'Authentication required'},{status:401});

  let form:FormData;
  try{form=await request.formData();}
  catch{return NextResponse.json({ok:false,error:'Expected multipart/form-data'},{status:400});}

  const character=fileFrom(form,'character');
  const product=fileFrom(form,'product');
  if(!character||!product){
    return NextResponse.json({ok:false,error:'character and product JPEG files are required'},{status:400});
  }
  if(
    character.size<=0||product.size<=0||
    character.size>DIRECTOR_REFERENCE_MAX_BYTES||product.size>DIRECTOR_REFERENCE_MAX_BYTES||
    character.size>MAX_DIRECT_FILE_BYTES||product.size>MAX_DIRECT_FILE_BYTES||
    character.size+product.size>MAX_DIRECT_COMBINED_BYTES
  ){
    return NextResponse.json({
      ok:false,
      error:'DIRECTOR_BONEZ_DIRECT_BYTES_TOO_LARGE',
      limits:{maxEach:MAX_DIRECT_FILE_BYTES,maxCombined:MAX_DIRECT_COMBINED_BYTES},
    },{status:413});
  }

  const [characterBytes,productBytes]=await Promise.all([
    character.arrayBuffer().then(value=>new Uint8Array(value)),
    product.arrayBuffer().then(value=>new Uint8Array(value)),
  ]);

  try{
    inspectDirectorReferenceImage(characterBytes,character.type||'image/jpeg');
    inspectDirectorReferenceImage(productBytes,product.type||'image/jpeg');
  }catch(cause){
    return NextResponse.json({
      ok:false,
      error:cause instanceof Error?cause.message:'DIRECTOR_BONEZ_REFERENCE_IMAGE_INVALID',
    },{status:400});
  }

  const characterSha=sha256(characterBytes);
  const productSha=sha256(productBytes);
  if(characterSha!==BONEZ_REFERENCE_SHA256||productSha!==BONEZ_PRODUCT_REFERENCE_SHA256){
    return NextResponse.json({
      ok:false,
      error:'DIRECTOR_BONEZ_REFERENCE_SHA_MISMATCH',
      expected:{character:BONEZ_REFERENCE_SHA256,product:BONEZ_PRODUCT_REFERENCE_SHA256},
      actual:{character:characterSha,product:productSha},
      note:'This endpoint only admits the already-certified compact Bonez derivatives; it never silently repins canon.',
    },{status:409});
  }

  const oidc=oidcToken(request);
  if(!oidc) return NextResponse.json({ok:false,error:'DIRECTOR_VERCEL_OIDC_REQUIRED'},{status:503});

  const gateway=process.env.JHADINA_DIRECTOR_BONEZ_GATEWAY_URL?.trim()||DEFAULT_BONEZ_GATEWAY_URL;
  const response=await fetch(gateway,{
    method:'POST',
    headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json'},
    body:JSON.stringify({
      mode:'direct',
      userId:user.id,
      characterBase64:Buffer.from(characterBytes).toString('base64'),
      productBase64:Buffer.from(productBytes).toString('base64'),
      canonical:canonicalPayload(new Date().toISOString(),user.id),
    }),
    cache:'no-store',
  });
  const payload=await response.json().catch(()=>({ok:false,error:'DIRECTOR_BONEZ_GATEWAY_INVALID_JSON'}));
  return NextResponse.json(payload,{status:response.status,headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}});
}

export async function GET(){
  return NextResponse.json({
    ok:true,
    phase:'DIRECTOR-QUALITY.2-LIVE',
    projectId:BONEZ_PROJECT_ID,
    characterId:BONEZ_CHARACTER_ID,
    readyForDirectAdmission:true,
    requiredFiles:['character','product'],
    expectedSha256:{character:BONEZ_REFERENCE_SHA256,product:BONEZ_PRODUCT_REFERENCE_SHA256},
    originalUploadSha256:BONEZ_ORIGINAL_UPLOAD_SHA256,
    limits:{maxEach:MAX_DIRECT_FILE_BYTES,maxCombined:MAX_DIRECT_COMBINED_BYTES},
    canonRepinning:false,
  },{headers:{'cache-control':'no-store'}});
}
