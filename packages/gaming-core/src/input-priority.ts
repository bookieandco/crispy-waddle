import type { CanonicalGameInput } from './controller.js';

export type InputPriority='emergency-neutralize'|'button-transition'|'axis-change'|'heartbeat';
export interface PrioritizedInput { input:CanonicalGameInput; priority:InputPriority; sequenceNumber:number; }
const rank=(p:InputPriority)=>p==='emergency-neutralize'?0:p==='button-transition'?1:p==='axis-change'?2:3;
export class InputPriorityQueue { private queue:PrioritizedInput[]=[]; enqueue(item:PrioritizedInput):void{this.queue.push(item);this.queue.sort((a,b)=>rank(a.priority)-rank(b.priority)||a.sequenceNumber-b.sequenceNumber);} enqueueNeutral(input:CanonicalGameInput,sequenceNumber:number):void{this.enqueue({input,sequenceNumber,priority:'emergency-neutralize'});} dequeue():PrioritizedInput|undefined{return this.queue.shift();} clear():void{this.queue=[];} size():number{return this.queue.length;} }
