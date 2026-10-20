import {describe,expect,it} from "vitest";
import {compareMusicDawReopen} from "./music-daw-reopen-acceptance";
import type {MusicDawSession} from "@jhadina/music-core";

const saved={schemaVersion:"jhadina-music-daw/v1",caseId:"private-case",
  revision:3,tracks:[{gainDb:-3,eq:{lowDb:1,midDb:0,highDb:-1}}],tempoBpm:99};
describe("DAW save/reopen acceptance receipt",()=>{
  it("accepts identical saved edits despite PostgreSQL JSONB key ordering",()=>{
    const reordered={revision:3,tempoBpm:99,tracks:[{eq:{highDb:-1,midDb:0,lowDb:1},
      gainDb:-3}],caseId:"private-case",schemaVersion:"jhadina-music-daw/v1"};
    const checked=compareMusicDawReopen(saved as never as MusicDawSession,
      reordered as never as MusicDawSession,true);
    expect(checked.verified).toBe(true);
    expect(checked.revision).toBe(3);
  });
  it("fails closed on unsaved projects, changed EQ, changed revisions and other case IDs",()=>{
    const first=saved as never as MusicDawSession;
    expect(()=>compareMusicDawReopen(first,first,false)).toThrow("NOT_PERSISTED");
    expect(()=>compareMusicDawReopen(first,{...saved,revision:4} as never as MusicDawSession,true))
      .toThrow("REVISION_MISMATCH");
    expect(()=>compareMusicDawReopen(first,{...saved,
      tracks:[{gainDb:-5}]} as never as MusicDawSession,true))
      .toThrow("CONTENT_MISMATCH");
    expect(()=>compareMusicDawReopen(first,{...saved,
      caseId:"other-owner-case"} as never as MusicDawSession,true))
      .toThrow("REVISION_MISMATCH");
  });
});
