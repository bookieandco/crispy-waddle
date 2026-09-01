export type InputIntegrityState='healthy'|'reordered'|'duplicate'|'stale'|'disconnected';
export interface InputIntegrityEvent { inputId:string; sequenceNumber:number; capturedAtMs:number; sessionId?:string; deviceId?:string; }
export interface InputIntegrityResult { accepted:boolean; state:InputIntegrityState; lastSequenceNumber:number; expectedSequenceNumber:number; droppedCount:number; }
export interface InputIntegritySnapshot { sessionId?:string; deviceId?:string; lastSequenceNumber:number; acceptedCount:number; duplicateCount:number; reorderedCount:number; staleCount:number; droppedCount:number; state:InputIntegrityState; }
export class InputIntegrityMonitor {
  private last=-1;
  private seen=new Set<string>();
  private acceptedCount=0;
  private duplicateCount=0;
  private reorderedCount=0;
  private staleCount=0;
  private droppedCount=0;
  private state:InputIntegrityState='healthy';
  constructor(private readonly staleAfterMs=250,private readonly requireContiguousSequence=false){if(!Number.isFinite(staleAfterMs)||staleAfterMs<0)throw new Error('staleAfterMs must be non-negative');}
  accept(event:InputIntegrityEvent,nowMs=Date.now()):InputIntegrityResult {
    this.validate(event);
    if(this.seen.has(event.inputId)){this.duplicateCount++;this.state='duplicate';return this.result(false,'duplicate');}
    if(nowMs-event.capturedAtMs>this.staleAfterMs){this.staleCount++;this.state='stale';return this.result(false,'stale');}
    const expected=this.last+1;
    if(event.sequenceNumber<=this.last){this.reorderedCount++;this.state='reordered';return this.result(false,'reordered');}
    if(this.requireContiguousSequence&&event.sequenceNumber>expected){this.reorderedCount++;this.droppedCount+=event.sequenceNumber-expected;this.state='reordered';return this.result(false,'reordered');}
    this.seen.add(event.inputId);
    this.last=event.sequenceNumber;
    this.acceptedCount++;
    this.state='healthy';
    if(this.seen.size>2048){const first=this.seen.values().next().value;if(first)this.seen.delete(first);}
    return this.result(true,'healthy');
  }
  disconnect():void{this.state='disconnected';}
  reconnect(nextSequence=this.last+1):void{if(!Number.isInteger(nextSequence)||nextSequence<0)throw new Error('nextSequence must be a non-negative integer');this.last=nextSequence-1;this.state='healthy';}
  snapshot():InputIntegritySnapshot{return{lastSequenceNumber:this.last,acceptedCount:this.acceptedCount,duplicateCount:this.duplicateCount,reorderedCount:this.reorderedCount,staleCount:this.staleCount,droppedCount:this.droppedCount,state:this.state};}
  private result(accepted:boolean,state:InputIntegrityState):InputIntegrityResult{return{accepted,state,lastSequenceNumber:this.last,expectedSequenceNumber:this.last+1,droppedCount:this.droppedCount};}
  private validate(event:InputIntegrityEvent):void{if(!event.inputId.trim())throw new Error('inputId is required');if(!Number.isInteger(event.sequenceNumber)||event.sequenceNumber<0)throw new Error('sequenceNumber must be a non-negative integer');if(!Number.isFinite(event.capturedAtMs))throw new Error('capturedAtMs must be finite');}
}
