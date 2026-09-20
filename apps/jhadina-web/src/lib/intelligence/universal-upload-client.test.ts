import { describe, expect, it } from "vitest";
import {
  encodeTusMetadata,
  createUniversalUploadTask,
  effectiveUploadMediaType,
} from "./universal-upload-client";

describe("effectiveUploadMediaType", () => {
  it("infers supported MIME when a browser leaves File.type empty", () => {
    expect(effectiveUploadMediaType({ name: "notes.md", type: "" })).toBe("text/markdown");
    expect(effectiveUploadMediaType({ name: "fight.MOV", type: "" })).toBe("video/quicktime");
    expect(effectiveUploadMediaType({ name: "unknown.bin", type: "" })).toBe("");
  });
});

describe("encodeTusMetadata", () => {
  it("encodes UTF-8 TUS metadata values", () => {
    const encoded = encodeTusMetadata({ bucketName: "bucket", objectName: "folder/fight.mp4" });
    expect(encoded).toContain("bucketName YnVja2V0");
    expect(encoded).toContain("objectName Zm9sZGVyL2ZpZ2h0Lm1wNA==");
  });
});

describe("createUniversalUploadTask", () => {
  it("uses signed TUS create/head/patch then finalizes and polls for large files", async () => {
    const file = Object.assign(new Blob([new Uint8Array(7 * 1024 * 1024)], { type: "video/mp4" }), {
      name: "fight.mp4",
      lastModified: 1,
    }) as File;
    let offset = 0;
    let patchAttempts = 0;
    const calls:string[] = [];
    const fetchImpl:any = async (url:string, init:any = {}) => {
      calls.push(`${init.method ?? "GET"} ${url}`);
      if (url === "/api/jhadina/upload/session") {
        return new Response(JSON.stringify({ success:true, data:{
          session:{id:"s1",expiresAt:"2026-09-20T00:00:00Z"},
          upload:{path:"q",token:"sig",resumable:{
            endpoint:"https://project.storage.supabase.co/storage/v1/upload/resumable",
            headers:{"x-signature":"sig"},
            chunkSizeBytes:6*1024*1024,
            metadata:{bucketName:"jhadina-intake-private",objectName:"q",contentType:"video/mp4",cacheControl:"3600"},
          }},
          finalizePath:"/api/jhadina/upload/session/s1",
        }}), { status:201, headers:{"content-type":"application/json"} });
      }
      if (url.includes("/upload/resumable") && init.method === "POST") {
        return new Response(null, { status:201, headers:{Location:"https://upload.test/u1"} });
      }
      if (url === "https://upload.test/u1" && init.method === "HEAD") {
        return new Response(null, { status:200, headers:{"Upload-Offset":String(offset)} });
      }
      if (url === "https://upload.test/u1" && init.method === "PATCH") {
        patchAttempts += 1;
        if (patchAttempts === 1) return new Response(null, { status:503 });
        offset += (init.body as Blob).size;
        return new Response(null, { status:204, headers:{"Upload-Offset":String(offset)} });
      }
      if (url === "/api/jhadina/upload/session/s1") {
        return new Response(JSON.stringify({success:true,data:{perceptionJob:{
          id:"perception:u:a",status:"queued",attempt:0,maxAttempts:4,availableAt:"2026-09-19T00:00:00Z",
        }}}), {status:202});
      }
      if (url === "/api/jhadina/perception/perception%3Au%3Aa") {
        return new Response(JSON.stringify({success:true,data:{
          id:"perception:u:a",status:"completed",attempt:1,maxAttempts:4,availableAt:"2026-09-19T00:00:00Z",
          proposedRoutes:[{subsystem:"sports-intelligence",reason:"sports",confidence:.9}],
        }}), {status:200});
      }
      throw new Error(`unexpected ${init.method} ${url}`);
    };

    const task = createUniversalUploadTask({ file, fetchImpl });
    const result = await task.promise;
    expect(task.direct).toBe(true);
    expect(result.status).toBe("completed");
    expect(offset).toBe(file.size);
    expect(patchAttempts).toBeGreaterThan(2);
    expect(calls.some((call)=>call.startsWith("PATCH https://upload.test/u1"))).toBe(true);
  });
});
