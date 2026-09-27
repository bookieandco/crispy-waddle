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
