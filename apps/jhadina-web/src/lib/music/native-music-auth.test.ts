import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { authorizedNativeMusicScope } from "./native-music-auth";
import { MusicAuthRequiredError } from "./music-request-scope";
describe("native music auth is never a user-supplied ID",()=>{
  it("rejects absent or malformed bearer credentials before database work",async()=>{
    for(const headers of [{},{authorization:"Bearer"},{authorization:"Token abc"},
      {authorization:"Bearer abc xyz"}]){
      const req=new NextRequest("https://example.test/api/music/native/tracks",{headers});
      await expect(authorizedNativeMusicScope(req)).rejects.toBeInstanceOf(MusicAuthRequiredError);
    }
  });
});
