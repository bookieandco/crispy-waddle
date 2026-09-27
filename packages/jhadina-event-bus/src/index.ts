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

export class InMemoryEventJournal implements EventJournal {
  private readonly events:DomainEvent<unknown>[]=[];
  private readonly ids=new Set<string>();
  private readonly idempotency=new Set<string>();

  async append(event:DomainEvent<unknown>):Promise<'appended'|'duplicate'>{
    assertTraceableEvent(event);
    const key=`${event.context!.workSessionId}:${event.context!.idempotencyKey}`;
    if(this.ids.has(event.id)||this.idempotency.has(key))return 'duplicate';
    this.ids.add(event.id);
    this.idempotency.add(key);
    this.events.push(freezeEvent(event));
    return 'appended';
  }

  async listByWorkSession(workSessionId:string):Promise<readonly DomainEvent<unknown>[]>{
    return Object.freeze(this.events.filter(event=>event.context?.workSessionId===workSessionId));
  }
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


export interface RuntimeEventDatabaseError {
  code?:string;
  message:string;
}

export interface RuntimeEventDatabaseClient {
  from(table:string):{
    insert(values:Record<string,unknown>):PromiseLike<{error:RuntimeEventDatabaseError|null}>;
    select(columns:string):{
      eq(column:string,value:string):{
        order(column:string,options:{ascending:boolean}):PromiseLike<{data:unknown[]|null;error:RuntimeEventDatabaseError|null}>;
      };
    };
  };
}

/**
 * Production journal adapter. Database uniqueness on
 * (work_session_id,idempotency_key) is the duplicate-suppression authority.
 */
export class SupabaseEventJournal implements EventJournal {
  constructor(private readonly db:RuntimeEventDatabaseClient){}

  async append(event:DomainEvent<unknown>):Promise<'appended'|'duplicate'>{
    assertTraceableEvent(event);
    const context=event.context;
    const {error}=await this.db.from('jhadina_runtime_events').insert({
      id:event.id,
      event_type:event.type,
      occurred_at:event.occurredAt,
      payload:event.payload,
      work_session_id:context.workSessionId,
      task_id:context.taskId??null,
      correlation_id:context.correlationId,
      causation_id:context.causationId??null,
      actor_id:context.actorId??null,
      domain:context.domain,
      capability:context.capability??null,
      authority_ref:context.authorityRef??null,
      idempotency_key:context.idempotencyKey,
    });
    if(!error)return 'appended';
    if(error.code==='23505')return 'duplicate';
    throw new Error(`RUNTIME_EVENT_APPEND_FAILED:${error.message}`);
  }

  async listByWorkSession(workSessionId:string):Promise<readonly DomainEvent<unknown>[]>{
    const {data,error}=await this.db.from('jhadina_runtime_events')
      .select('*').eq('work_session_id',workSessionId).order('sequence_id',{ascending:true});
    if(error)throw new Error(`RUNTIME_EVENT_LIST_FAILED:${error.message}`);
    return Object.freeze((data??[]).map(row=>eventFromDatabaseRow(row as Record<string,unknown>)));
  }
}

function eventFromDatabaseRow(row:Record<string,unknown>):DomainEvent<unknown>{
  return freezeEvent({
    id:String(row.id??''),
    type:String(row.event_type??''),
    occurredAt:String(row.occurred_at??''),
    payload:row.payload,
    context:{
      workSessionId:String(row.work_session_id??''),
      taskId:nullableString(row.task_id),
      correlationId:String(row.correlation_id??''),
      causationId:nullableString(row.causation_id),
      actorId:nullableString(row.actor_id),
      domain:String(row.domain??''),
      capability:nullableString(row.capability),
      authorityRef:nullableString(row.authority_ref),
      idempotencyKey:String(row.idempotency_key??''),
    },
  });
}

function nullableString(value:unknown):string|undefined{
  return typeof value==='string'&&value.length>0?value:undefined;
}
