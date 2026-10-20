import {afterEach,describe,expect,it,vi} from "vitest";
import {uploadPrivateDirectWav} from "./music-direct-wav-client";

vi.mock("@/lib/supabase/public-config",()=>({
  getSupabasePublicConfig:()=>({url:"https://kqbkaozfjubkjevdfvic.supabase.co",
    publishableKey:"sb_publishable_test"}),
}));
const CHUNK=6*1024*1024;
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()});
describe("direct private WAV signed TUS transport",()=>{
 it("resumes a committed-but-unacknowledged chunk without resending original bytes",async()=>{
  const file=new File([new Uint8Array(CHUNK+1)],"my-song.wav",{type:"audio/wav"});
  const writes:Array<{offset:number,size:number}>=[];
  const progress:number[]=[];
  let committed=0,first=true;
  const upstream=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=String(input);
    const action=init?.method??"GET";
    if(url==="/api/music/restoration/direct-upload"){
      const body=JSON.parse(String(init?.body));
      if(body.action==="ticket")return Response.json({success:true,
        caseId:"music-restoration:608a309b-15d3-4e86-bd88-a4d85156d28a",
        path:"owner/case/source/hash/my-song.wav",token:"signed-token",
        bucket:"jhadina-music-restoration",maxBytes:96*1024*1024});
      if(body.action==="finalize")return Response.json({success:true,
        mode:"direct-private-wav",workerUsed:false,restorationCertified:false,
        restorationCase:{id:body.caseId},sourceArtifact:{id:"audio-id",sha256:body.sha256}});
    }
    if(url.endsWith("/storage/v1/upload/resumable") && action==="POST")
      return new Response(null,{status:201,headers:{location:
        "https://kqbkaozfjubkjevdfvic.storage.supabase.co/storage/v1/upload/resumable/123"}});
    if(url.endsWith("/storage/v1/upload/resumable/123")&&action==="PATCH"){
      const headers=new Headers(init?.headers);
      expect(headers.get("x-signature")).toBe("signed-token");
      const offset=Number(headers.get("Upload-Offset"));
      const size=(init?.body as Blob).size;
      writes.push({offset,size});
      if(first){first=false;committed=offset+size;throw new TypeError("network response lost");}
      committed=offset+size;
      return new Response(null,{status:204,headers:{"Upload-Offset":String(committed)}});
    }
    if(url.endsWith("/storage/v1/upload/resumable/123")&&action==="HEAD")
      return new Response(null,{status:200,headers:{"Upload-Offset":String(committed)}});
    throw new Error("Unexpected request "+url+" "+action);
  });
  vi.stubGlobal("fetch",upstream);
  const result=await uploadPrivateDirectWav({file,userId:"owner",
    onProgress:n=>progress.push(n)});
  expect(result.workerUsed).toBe(false);
  expect(result.restorationCertified).toBe(false);
  expect(writes).toEqual([{offset:0,size:CHUNK},{offset:CHUNK,size:1}]);
  expect(progress.at(-1)).toBe(100);
 });
});
