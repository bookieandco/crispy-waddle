import type {
  WeeklySocialActionStateRow,
  WeeklySocialRuntimeRepository,
} from "./weekly-runtime-repository";
import {
  runWeeklySocialScheduler,
  type WeeklyActionExecutionHandler,
  type WeeklySchedulerRunResult,
} from "./weekly-runtime-worker";

export interface WeeklyProtectedWorkerOwnerReceipt {
  ownerUserId: string;
  dueActions: number;
  dueKinds: readonly string[];
  missingHandlerKinds: readonly string[];
  dispatched: boolean;
  scheduler?: WeeklySchedulerRunResult;
}

export interface WeeklyProtectedWorkerReceipt {
  ranAt: string;
  activeOwners: number;
  ownersWithDueWork: number;
  dueActions: number;
  dispatchedOwners: number;
  blockedOwners: number;
  commissionedHandlerKinds: readonly string[];
  missingHandlerKinds: readonly string[];
  ownerReceipts: readonly WeeklyProtectedWorkerOwnerReceipt[];
  authority: "PROTECTED_WEEKLY_SOCIAL_WORKER";
  externalAuthorityMinted: false;
  policy: Readonly<{
    ownerDiscoveryIsReadOnly: true;
    incompleteHandlerCoverageDoesNotMutateActions: true;
    executionUsesRestartSafeScheduler: true;
    weeklyPermitsRemainRequired: true;
  }>;
}

export async function runProtectedWeeklySocialWorker(input: {
  repository: WeeklySocialRuntimeRepository;
  handlers: readonly WeeklyActionExecutionHandler[];
  now?: Date;
  ownerLimit?: number;
  actionLimitPerOwner?: number;
}): Promise<WeeklyProtectedWorkerReceipt> {
  const now=input.now??new Date();
  const observedAt=now.toISOString();
  const ownerLimit=bounded(input.ownerLimit??50,1,200,"SOCIAL_WEEKLY_OWNER_LIMIT_INVALID");
  const actionLimit=bounded(input.actionLimitPerOwner??25,1,100,"SOCIAL_WEEKLY_ACTION_LIMIT_INVALID");
  const owners=await input.repository.listActiveOwnerIds({observedAt,limit:ownerLimit});
  const receipts:WeeklyProtectedWorkerOwnerReceipt[]=[];
  const allDueKinds=new Set<string>();
  const commissionedKinds=new Set<string>();

  for(const kind of ["organic_publication","public_comment","paid_campaign","director_production"]){
    if(input.handlers.some((handler)=>handler.supports(kind)))commissionedKinds.add(kind);
  }

  for(const ownerUserId of owners){
    const due=await input.repository.listDueActions({
      ownerUserId,
      observedAt,
      limit:actionLimit,
    });
    if(!due.length)continue;
    const dueKinds=unique(due.map((row)=>row.action_kind));
    dueKinds.forEach((kind)=>allDueKinds.add(kind));
    const missing=dueKinds.filter(
      (kind)=>!input.handlers.some((handler)=>handler.supports(kind)),
    );
    if(missing.length){
      receipts.push(Object.freeze({
        ownerUserId,
        dueActions:due.length,
        dueKinds:Object.freeze(dueKinds),
        missingHandlerKinds:Object.freeze(missing),
        dispatched:false,
      }));
      continue;
    }
    const scheduler=await runWeeklySocialScheduler({
      ownerUserId,
      observedAt,
      repository:input.repository,
      handlers:input.handlers,
      limit:actionLimit,
    });
    receipts.push(Object.freeze({
      ownerUserId,
      dueActions:due.length,
      dueKinds:Object.freeze(dueKinds),
      missingHandlerKinds:Object.freeze([]),
      dispatched:true,
      scheduler,
    }));
  }

  const missingHandlerKinds=[...allDueKinds].filter(
    (kind)=>!commissionedKinds.has(kind),
  ).sort();

  return Object.freeze({
    ranAt:observedAt,
    activeOwners:owners.length,
    ownersWithDueWork:receipts.length,
    dueActions:receipts.reduce((sum,row)=>sum+row.dueActions,0),
    dispatchedOwners:receipts.filter((row)=>row.dispatched).length,
    blockedOwners:receipts.filter((row)=>!row.dispatched).length,
    commissionedHandlerKinds:Object.freeze([...commissionedKinds].sort()),
    missingHandlerKinds:Object.freeze(missingHandlerKinds),
    ownerReceipts:Object.freeze(receipts),
    authority:"PROTECTED_WEEKLY_SOCIAL_WORKER" as const,
    externalAuthorityMinted:false as const,
    policy:Object.freeze({
      ownerDiscoveryIsReadOnly:true as const,
      incompleteHandlerCoverageDoesNotMutateActions:true as const,
      executionUsesRestartSafeScheduler:true as const,
      weeklyPermitsRemainRequired:true as const,
    }),
  });
}

export function createUncommissionedWeeklySocialHandlers():
  readonly WeeklyActionExecutionHandler[]{
  return Object.freeze([]);
}

function bounded(value:number,min:number,max:number,error:string):number{
  if(!Number.isInteger(value)||value<min||value>max)throw new Error(error);
  return value;
}
function unique(values:readonly string[]):string[]{
  return [...new Set(values.filter(Boolean))].sort();
}
