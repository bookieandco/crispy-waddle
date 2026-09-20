import type { CanonicalGameInput } from './controller.js';

export interface SamplingDecision { send:boolean; reason:'button-change'|'axis-change'|'heartbeat'|'unchanged'; input:CanonicalGameInput; }
export interface SamplingPolicy { heartbeatMs?:number; axisEpsilon?:number; }
const axes=(a:CanonicalGameInput,b:CanonicalGameInput,e:number)=>Math.abs(a.leftStick.x-b.leftStick.x)>e||Math.abs(a.leftStick.y-b.leftStick.y)>e||Math.abs(a.rightStick.x-b.rightStick.x)>e||Math.abs(a.rightStick.y-b.rightStick.y)>e;
export function decideSample(previous:CanonicalGameInput|undefined,current:CanonicalGameInput,nowMs:number,lastSentMs:number,policy:SamplingPolicy={}):SamplingDecision {if(!previous)return{send:true,reason:'button-change',input:current};if(previous.buttons.size!==current.buttons.size||[...previous.buttons].some(b=>!current.buttons.has(b)))return{send:true,reason:'button-change',input:current};if(axes(previous,current,policy.axisEpsilon??0.01))return{send:true,reason:'axis-change',input:current};if(nowMs-lastSentMs>=Math.max(1,policy.heartbeatMs??100))return{send:true,reason:'heartbeat',input:current};return{send:false,reason:'unchanged',input:current};}
