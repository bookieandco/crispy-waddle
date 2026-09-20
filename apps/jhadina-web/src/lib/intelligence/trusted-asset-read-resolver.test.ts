import { describe, expect, it } from "vitest";
import { SupabaseTrustedAssetReadResolver } from "./trusted-asset-read-resolver";

describe("SupabaseTrustedAssetReadResolver", () => {
  it("creates a signed URL only for the actor's trusted asset", async () => {
    let path = "";
    const client:any = {
      storage: {
        from(bucket:string) {
          expect(bucket).toBe("jhadina-intake-private");
          return {
            async createSignedUrl(value:string) {
              path = value;
              return { data: { signedUrl: "https://signed.test" }, error: null };
            },
          };
        },
      },
    };
    const resolver = new SupabaseTrustedAssetReadResolver(client);
    const url = await resolver.signedReadUrl({
      actorId: "u1",
      assetRef: "supabase://jhadina-intake-private/trusted/u1/x/video.mp4",
    });
    expect(url).toBe("https://signed.test");
    expect(path).toBe("trusted/u1/x/video.mp4");
  });

  it("rejects quarantine and cross-actor references", async () => {
    const resolver = new SupabaseTrustedAssetReadResolver({} as any);
    await expect(resolver.signedReadUrl({
      actorId: "u1",
      assetRef: "supabase://jhadina-intake-private/quarantine/u1/x/video.mp4",
    })).rejects.toThrow("SCOPE_MISMATCH");
    await expect(resolver.signedReadUrl({
      actorId: "u1",
      assetRef: "supabase://jhadina-intake-private/trusted/u2/x/video.mp4",
    })).rejects.toThrow("SCOPE_MISMATCH");
  });
});
