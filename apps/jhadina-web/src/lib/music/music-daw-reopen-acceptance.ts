import type {MusicDawSession} from "@jhadina/music-core";

/** Sort JSONB object keys for cross-device comparison; never contains audio bytes. */
function canonical(value:unknown):unknown {
  if(Array.isArray(value))return value.map(canonical);
  if(value!==null&&typeof value==="object"){
    const result:Record<string,unknown>={};
    for(const key of Object.keys(value).sort()){
      const inner=(value as Record<string,unknown>)[key];
      if(inner!==undefined)result[key]=canonical(inner);
    }
    return result;
  }
  return value;
}
export function compareMusicDawReopen(
  expected:MusicDawSession,
  saved:MusicDawSession,
  persisted:boolean,
):{caseId:string;revision:number;verified:true;checkedAt:string} {
  if(!persisted)throw new Error("MUSIC_DAW_NOT_PERSISTED");
  if(expected.caseId!==saved.caseId||expected.revision<1||
     expected.revision!==saved.revision)
    throw new Error("MUSIC_DAW_REOPEN_REVISION_MISMATCH");
  if(JSON.stringify(canonical(expected))!==JSON.stringify(canonical(saved)))
    throw new Error("MUSIC_DAW_REOPEN_CONTENT_MISMATCH");
  return {
    caseId:expected.caseId,revision:expected.revision,verified:true,
    checkedAt:new Date().toISOString(),
  };
}
