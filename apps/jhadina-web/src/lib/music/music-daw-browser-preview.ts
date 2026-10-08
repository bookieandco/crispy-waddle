"use client";
import {
  activeMusicDawClip, musicDawClipGain, admitMusicDawPlugin,
  type MusicDawSession, type MusicDawTrack, type MusicDawPluginSlot,
} from "@jhadina/music-core";

type PreviewChannel={trackId:string;audio:HTMLAudioElement;gain:GainNode;
  source:MediaElementAudioSourceNode;nodes:AudioNode[]};
const db=(value:number)=>Math.pow(10,value/20);
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const maxDuration=(session:MusicDawSession)=>Math.max(0,...session.tracks.flatMap(t=>t.clips.map(c=>c.endSeconds)));
function appendWebFx(context:AudioContext,input:AudioNode,slot:MusicDawPluginSlot,
  nodes:AudioNode[]):AudioNode {
  if(!slot.enabled||!admitMusicDawPlugin(slot,"phone-web").executableHere)return input;
  if(slot.pluginId==="jhadina.web.highpass"){
    const high=context.createBiquadFilter();
    high.type="highpass";high.frequency.value=clamp(slot.parameters.frequencyHz??90,20,4000);
    input.connect(high);nodes.push(high);return high;
  }
  if(slot.pluginId==="jhadina.web.delay"){
    const delay=context.createDelay(2), feedback=context.createGain();
    const wet=context.createGain(),dry=context.createGain(),sum=context.createGain();
    delay.delayTime.value=clamp(slot.parameters.timeSeconds??.25,.01,1.9);
    feedback.gain.value=clamp(slot.parameters.feedback??.18,0,.75);
    wet.gain.value=clamp(slot.parameters.wet??.2,0,.7);
    dry.gain.value=1-wet.gain.value;
    input.connect(dry);dry.connect(sum);
    input.connect(delay);delay.connect(wet);wet.connect(sum);
    delay.connect(feedback);feedback.connect(delay);
    nodes.push(delay,feedback,wet,dry,sum);return sum;
  }
  return input;
}
function makeChannel(context:AudioContext,track:MusicDawTrack,url:string):PreviewChannel {
  const audio=new Audio();
  audio.crossOrigin="anonymous";audio.preload="auto";audio.src=url;
  const source=context.createMediaElementSource(audio);
  const low=context.createBiquadFilter(),mid=context.createBiquadFilter(),high=context.createBiquadFilter();
  low.type="lowshelf";low.frequency.value=160;low.gain.value=track.eq.lowDb;
  mid.type="peaking";mid.frequency.value=1100;mid.Q.value=.8;mid.gain.value=track.eq.midDb;
  high.type="highshelf";high.frequency.value=6000;high.gain.value=track.eq.highDb;
  const comp=context.createDynamicsCompressor();
  comp.threshold.value=track.compressor.enabled?track.compressor.thresholdDb:0;
  comp.ratio.value=track.compressor.enabled?track.compressor.ratio:1;
  const gain=context.createGain(),pan=context.createStereoPanner();
  pan.pan.value=track.pan;
  const nodes:AudioNode[]=[source,low,mid,high,comp,gain,pan];
  source.connect(low);low.connect(mid);mid.connect(high);high.connect(comp);
  let end:AudioNode=comp;
  for(const fx of track.pluginRack??[])end=appendWebFx(context,end,fx,nodes);
  end.connect(gain);gain.connect(pan);pan.connect(context.destination);
  return {audio,trackId:track.artifactId,source,nodes,gain};
}

/** Interactive browser audition. Neither bounces/exports sound nor invokes VST/AU.
 * Owner's desktop companion is a separate, currently uncommissioned host. */
export class MusicDawBrowserPreview {
  private context:AudioContext|null=null;
  private channels:PreviewChannel[]=[];
  private timer:number|null=null;
  private playing=false;
  private origin=0;
  private startAt=0;
  private session:MusicDawSession|null=null;
  private tick:((seconds:number,playing:boolean)=>void)|null=null;
  private maxActive=12;
  async play(session:MusicDawSession,urls:Record<string,string>,seconds:number,
    onTick:(seconds:number,playing:boolean)=>void){
    await this.stop();
    const solo=session.tracks.some(t=>t.solo&&!t.mute);
    const tracks=session.tracks.filter(t=>!t.mute&&(!solo||t.solo)&&t.clips.length>0);
    if(!tracks.length)throw new Error("Unmute a stem to audition.");
    if(tracks.length>this.maxActive)throw new Error("Browser preview is limited to 12 simultaneous stems; bounce on the desktop host for larger sessions.");
    for(const track of tracks)if(!urls[track.artifactId])
      throw new Error("No private audio URL for "+track.name);
    const context=new AudioContext();
    this.context=context;this.session=session;this.tick=onTick;
    try{
      await context.resume();
      this.channels=tracks.map(track=>makeChannel(context,track,urls[track.artifactId]!));
      this.startAt=clamp(seconds,0,maxDuration(session));
      this.origin=performance.now()-this.startAt*1000;
      this.playing=true;
      this.update();
      this.timer=window.setInterval(()=>this.update(),50);
    }catch(error){
      await this.stop();throw error;
    }
  }
  private update(){
    if(!this.playing||!this.session)return;
    const seconds=(performance.now()-this.origin)/1000;
    if(seconds>=maxDuration(this.session)){void this.stop();this.tick?.(0,false);return}
    const solo=this.session.tracks.some(t=>t.solo&&!t.mute);
    for(const channel of this.channels){
      const track=this.session.tracks.find(x=>x.artifactId===channel.trackId);
      if(!track)continue;
      const clip=activeMusicDawClip(track,seconds);
      const live=!!clip&&!track.mute&&(!solo||track.solo);
      channel.gain.gain.value=live?db(track.gainDb)*musicDawClipGain(clip!,seconds):0;
      if(live){
        const position=clip!.sourceOffsetSeconds+(seconds-clip!.startSeconds);
        if(channel.audio.readyState>=1&&Math.abs(channel.audio.currentTime-position)>.13){
          channel.audio.currentTime=clamp(position,0,track.durationSeconds);
        }
        if(channel.audio.paused)void channel.audio.play().catch(()=>undefined);
      }else if(!channel.audio.paused)channel.audio.pause();
    }
    this.tick?.(seconds,true);
  }
  updateSession(session:MusicDawSession){
    this.session=session;
    // Changes to EQ/compression/fx require new nodes; new Play rebuilds them.
  }
  async stop(){
    this.playing=false;
    if(this.timer!==null){window.clearInterval(this.timer);this.timer=null}
    for(const c of this.channels){c.audio.pause();c.audio.removeAttribute("src");c.audio.load();
      for(const n of c.nodes)try{n.disconnect()}catch{}}
    this.channels=[];
    const previous=this.context;this.context=null;
    if(previous)await previous.close().catch(()=>undefined);
  }
}
