export interface RuntimeEventContext {
  readonly workSessionId:string;
  readonly taskId?:string;
  readonly correlationId:string;
  readonly causationId?:string;
  readonly actorId?:string;
  readonly domain:string;
  readonly capability?:string;
  /** Traceability only. This reference never grants authority. */
  readonly authorityRef?:string;
  readonly idempotencyKey:string;
}

export interface DomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
  readonly context?:RuntimeEventContext;
}

export type EventHandler<TPayload = unknown> = (event: DomainEvent<TPayload>) => void | Promise<void>;

export interface EventBus {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
  subscribe<TPayload>(type: string, handler: EventHandler<TPayload>): () => void;
}

export interface EventJournal {
  append(event:DomainEvent<unknown>):Promise<'appended'|'duplicate'>;
  listByWorkSession(workSessionId:string):Promise<readonly DomainEvent<unknown>[]>;
}

export interface EventJournalEntry {
  readonly offset:number;
  readonly event:DomainEvent<unknown>;
}

export interface ReplayableEventJournal extends EventJournal {
  readAfter(workSessionId:string,afterOffset:number,limit:number):Promise<readonly EventJournalEntry[]>;
}

export interface EventConsumerCheckpoint {
  readonly consumerId:string;
  readonly workSessionId:string;
  readonly offset:number;
  readonly updatedAt:string;
}

export interface EventConsumerCheckpointStore {
  get(consumerId:string,workSessionId:string):Promise<EventConsumerCheckpoint|null>;
  commit(input:{
    consumerId:string;
    workSessionId:string;
    expectedOffset:number;
    nextOffset:number;
    updatedAt:string;
  }):Promise<EventConsumerCheckpoint>;
}

export class InMemoryEventJournal implements ReplayableEventJournal {
  private readonly entries:EventJournalEntry[]=[];
  private readonly ids=new Set<string>();
  private readonly idempotency=new Set<string>();
  private nextOffset=1;

  async append(event:DomainEvent<unknown>):Promise<'appended'|'duplicate'>{
    assertTraceableEvent(event);
    const key=`${event.context!.workSessionId}:${event.context!.idempotencyKey}`;
    if(this.ids.has(event.id)||this.idempotency.has(key))return 'duplicate';
    this.ids.add(event.id);
    this.idempotency.add(key);
    this.entries.push(Object.freeze({offset:this.nextOffset++,event:freezeEvent(event)}));
    return 'appended';
  }

  async listByWorkSession(workSessionId:string):Promise<readonly DomainEvent<unknown>[]>{
    return Object.freeze(this.entries.filter(entry=>entry.event.context?.workSessionId===workSessionId).map(entry=>entry.event));
  }

  async readAfter(workSessionId:string,afterOffset:number,limit:number):Promise<readonly EventJournalEntry[]>{
    validateReplayCursor(afterOffset,limit);
    return Object.freeze(this.entries
      .filter(entry=>entry.offset>afterOffset&&entry.event.context?.workSessionId===workSessionId)
      .slice(0,limit));
  }
}

export class InMemoryEventConsumerCheckpointStore implements EventConsumerCheckpointStore {
  private readonly checkpoints=new Map<string,EventConsumerCheckpoint>();

  async get(consumerId:string,workSessionId:string):Promise<EventConsumerCheckpoint|null>{
    validateCheckpointIdentity(consumerId,workSessionId);
    return this.checkpoints.get(checkpointKey(consumerId,workSessionId))??null;
  }

  async commit(input:{
    consumerId:string;workSessionId:string;expectedOffset:number;nextOffset:number;updatedAt:string;
  }):Promise<EventConsumerCheckpoint>{
    validateCheckpointIdentity(input.consumerId,input.workSessionId);
    validateOffset(input.expectedOffset,'EVENT_CHECKPOINT_EXPECTED_OFFSET_INVALID');
    validateOffset(input.nextOffset,'EVENT_CHECKPOINT_NEXT_OFFSET_INVALID');
    if(input.nextOffset<input.expectedOffset)throw new Error('EVENT_CHECKPOINT_REWIND_FORBIDDEN');
    if(Number.isNaN(Date.parse(input.updatedAt)))throw new Error('EVENT_CHECKPOINT_TIME_INVALID');
    const key=checkpointKey(input.consumerId,input.workSessionId);
    const current=this.checkpoints.get(key);
    const currentOffset=current?.offset??0;
    if(currentOffset!==input.expectedOffset)throw new Error('EVENT_CHECKPOINT_CONFLICT');
    const next=Object.freeze({
      consumerId:input.consumerId,
      workSessionId:input.workSessionId,
      offset:input.nextOffset,
      updatedAt:input.updatedAt,
    });
    this.checkpoints.set(key,next);
    return next;
  }
}

export async function replayWorkSessionEvents(input:{
  journal:ReplayableEventJournal;
  checkpoints:EventConsumerCheckpointStore;
  consumerId:string;
  workSessionId:string;
  limit?:number;
  now?:string;
  handler:EventHandler<unknown>;
}):Promise<{processed:number;checkpointOffset:number}>{
  validateCheckpointIdentity(input.consumerId,input.workSessionId);
  const limit=input.limit??100;
  validateReplayCursor(0,limit);
  const checkpoint=await input.checkpoints.get(input.consumerId,input.workSessionId);
  let offset=checkpoint?.offset??0;
  const entries=await input.journal.readAfter(input.workSessionId,offset,limit);
  let processed=0;
  for(const entry of entries){
    await input.handler(entry.event);
    const next=await input.checkpoints.commit({
      consumerId:input.consumerId,
      workSessionId:input.workSessionId,
      expectedOffset:offset,
      nextOffset:entry.offset,
      updatedAt:input.now??new Date().toISOString(),
    });
    offset=next.offset;
    processed+=1;
  }
  return Object.freeze({processed,checkpointOffset:offset});
}

export class InMemoryEventBus implements EventBus {
  protected readonly handlers = new Map<string, Set<EventHandler<unknown>>>();

  subscribe<TPayload>(type: string, handler: EventHandler<TPayload>): () => void {
    const existing = this.handlers.get(type) ?? new Set<EventHandler<unknown>>();
    existing.add(handler as EventHandler<unknown>);
    this.handlers.set(type, existing);
    return () => existing.delete(handler as EventHandler<unknown>);
  }

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    assertDomainEvent(event);
    await this.dispatch(event);
  }

  protected async dispatch<TPayload>(event:DomainEvent<TPayload>):Promise<void>{
    const handlers = [...(this.handlers.get(event.type) ?? [])];
    for (const handler of handlers) {
      await handler(event as DomainEvent<unknown>);
    }
  }
}

/**
 * Production-oriented event-bus boundary: journal first, dispatch second.
 * A durable journal implementation can replace InMemoryEventJournal without
 * changing publishers/subscribers. Duplicate idempotency keys do not dispatch twice.
 */
export class DurableEventBus extends InMemoryEventBus {
  constructor(private readonly journal:EventJournal){super();}

  override async publish<TPayload>(event:DomainEvent<TPayload>):Promise<void>{
    assertDomainEvent(event);
    assertTraceableEvent(event);
    const result=await this.journal.append(event as DomainEvent<unknown>);
    if(result==='duplicate')return;
    await this.dispatch(event);
  }
}

export function assertTraceableEvent(event:DomainEvent<unknown>):asserts event is DomainEvent<unknown>&{context:RuntimeEventContext}{
  const context=event.context;
  if(!context)throw new Error('Domain event runtime context is required');
  if(!context.workSessionId.trim()||!context.correlationId.trim()||!context.domain.trim()||!context.idempotencyKey.trim()){
    throw new Error('Domain event runtime context is incomplete');
  }
}

function assertDomainEvent(event:DomainEvent<unknown>):void{
  if (!event.id || !event.type || !event.occurredAt) throw new Error('Invalid domain event');
}

function freezeEvent(event:DomainEvent<unknown>):DomainEvent<unknown>{
  return Object.freeze({
    ...event,
    context:event.context?Object.freeze({...event.context}):undefined,
  });
}

function validateReplayCursor(offset:number,limit:number):void{
  validateOffset(offset,'EVENT_REPLAY_OFFSET_INVALID');
  if(!Number.isInteger(limit)||limit<1||limit>1000)throw new Error('EVENT_REPLAY_LIMIT_INVALID');
}
function validateOffset(value:number,code:string):void{
  if(!Number.isInteger(value)||value<0)throw new Error(code);
}
function validateCheckpointIdentity(consumerId:string,workSessionId:string):void{
  if(!consumerId.trim()||!workSessionId.trim())throw new Error('EVENT_CHECKPOINT_IDENTITY_REQUIRED');
}
function checkpointKey(consumerId:string,workSessionId:string):string{return `${consumerId}:${workSessionId}`;}
