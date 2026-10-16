import {afterEach,describe,expect,it,vi} from 'vitest';
import {createBrowserGoogleCastRuntime} from './google-cast-runtime';

afterEach(()=>vi.unstubAllGlobals());

describe('JH-CLOSE.02D Google Cast session contract',()=>{
  it('reads the acquired session from CastContext and uses native media constructors',async()=>{
    const loads:unknown[]=[];
    const current={loadMedia:vi.fn(async(request:unknown)=>{loads.push(request)}),endSession:vi.fn(async()=>{})};
    const requestSession=vi.fn(async()=>undefined);
    class MediaInfo {streamType?:string;constructor(public contentId:string,public contentType:string){} }
    class LoadRequest {currentTime?:number;autoplay?:boolean;constructor(public mediaInfo:MediaInfo){}}
    vi.stubGlobal('window',{
      cast:{framework:{CastContext:{getInstance:()=>({requestSession,getCurrentSession:()=>current})}}},
      chrome:{cast:{media:{MediaInfo,LoadRequest}}},
    });
    const runtime=createBrowserGoogleCastRuntime();
    expect(runtime.isSupported()).toBe(true);
    const session=await runtime.requestSession();
    expect(requestSession).toHaveBeenCalledTimes(1);
    await session.loadMedia('https://media.example/video.mp4?token=redacted',12);
    expect(loads).toHaveLength(1);
    const request=loads[0] as LoadRequest;
    expect(request.mediaInfo.contentType).toBe('video/mp4');
    expect(request.currentTime).toBe(12);
    await expect(session.loadMedia('https://media.example/unknown-signed-stream',0)).rejects.toThrow('MIME type is unverified');
    expect(await session.getState()).toBeNull();
  });
  it('refuses a session-less SDK response',async()=>{
    vi.stubGlobal('window',{
      cast:{framework:{CastContext:{getInstance:()=>({
        requestSession:async()=>undefined,getCurrentSession:()=>null,
      })}}},
      chrome:{cast:{media:{MediaInfo:class {},LoadRequest:class {}}}},
    });
    await expect(createBrowserGoogleCastRuntime().requestSession()).rejects.toThrow('without a usable session');
  });
});
