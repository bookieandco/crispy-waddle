import type { CanonicalGameInput } from './controller.js';

export type ControllerSyncState='awaiting-neutral'|'synchronized';
export interface ControllerSyncResult { state:ControllerSyncState; acceptInput:boolean; input?:CanonicalGameInput; }
const neutral=(input:CanonicalGameInput)=>input.buttons.size===0&&Math.abs(input.leftStick.x)<0.01&&Math.abs(input.leftStick.y)<0.01&&Math.abs(input.rightStick.x)<0.01&&Math.abs(input.rightStick.y)<0.01;
export class ControllerStateSync { private state:ControllerSyncState='awaiting-neutral'; resync(input:CanonicalGameInput):ControllerSyncResult {if(!neutral(input)){this.state='awaiting-neutral';return{state:this.state,acceptInput:false};}this.state='synchronized';return{state:this.state,acceptInput:true,input};} accept(input:CanonicalGameInput):ControllerSyncResult {if(this.state!=='synchronized')return{state:this.state,acceptInput:false};return{state:this.state,acceptInput:true,input};} reset():void{this.state='awaiting-neutral';} getState():ControllerSyncState{return this.state;} }
