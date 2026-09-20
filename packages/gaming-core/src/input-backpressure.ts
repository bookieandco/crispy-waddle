import type { CanonicalGameInput } from './controller.js';
import type { InputPriority, PrioritizedInput } from './input-priority.js';

export interface BackpressureStats { droppedAxisUpdates:number; preservedTransitions:number; preservedNeutralizations:number; }
export class InputBackpressure { private pendingAxis?:PrioritizedInput; readonly stats:BackpressureStats={droppedAxisUpdates:0,preservedTransitions:0,preservedNeutralizations:0}; offer(item:PrioritizedInput):void {if(item.priority==='axis-change'){if(this.pendingAxis)this.stats.droppedAxisUpdates++;this.pendingAxis=item;return;}this.stats[item.priority==='emergency-neutralize'?'preservedNeutralizations':'preservedTransitions']++;} flush():PrioritizedInput|undefined {const item=this.pendingAxis;this.pendingAxis=undefined;return item;} clear():void{this.pendingAxis=undefined;} }
export function isCoalescible(priority:InputPriority):boolean{return priority==='axis-change';}
