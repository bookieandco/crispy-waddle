import {describe,expect,it} from "vitest";
import type {
  WeeklySocialActionStateRow,
  WeeklySocialRuntimeRepository,
} from "./weekly-runtime-repository";
import {
  runProtectedWeeklySocialWorker,
  type WeeklyProtectedWorkerReceipt,
} from "./weekly-production-worker";
import type {WeeklyActionExecutionHandler} from "./weekly-runtime-worker";

function row(
  owner:string,
  id:string,
  kind:string,
):WeeklySocialActionStateRow{
  return {
    user_id:owner,
    packet_id:"packet:"+owner,
    action_id:id,
    campaign_id:"campaign:"+owner,
    action_kind:kind,
    permit_id:"permit:"+id,
    action_fingerprint:"fingerprint:"+id,
    scheduled_at:"2026-10-09T17:00:00.000Z",
    status:"planned",
    attempt_count:0,
    external_receipt_refs:[],
    last_error:null,
    updated_at:"2026-10-09T17:00:00.000Z",
  };
}

function fakeRepository(
  owners:string[],
  due:Record<string,WeeklySocialActionStateRow[]>,
):{repo:WeeklySocialRuntimeRepository;updates:Record<string,unknown>[]}{
  const updates:Record<string,unknown>[]=[];
  const repo={
    async listActiveOwnerIds(){return owners;},
    async listDueActions(input:{ownerUserId:string}){
      return due[input.ownerUserId]??[];
    },
    async updateActionState(input:Record<string,unknown>){
      updates.push(input);
    },
    async saveDraftPacket(){},
    async registerApprovedPacket(){throw new Error("not used");},
    async saveReport(){},
    async upsertEngagementTarget(){},
    async listEngagementTargets(){return [];},
    async verify(){return true;},
    async consume(){return true;},
  } as unknown as WeeklySocialRuntimeRepository;
  return {repo,updates};
}

describe("protected weekly Social worker",()=>{
  it("discovers owners and leaves due actions untouched when handler coverage is incomplete",async()=>{
    const state=fakeRepository(
      ["user:one"],
      {"user:one":[row("user:one","paid:1","paid_campaign")]},
    );
    const result=await runProtectedWeeklySocialWorker({
      repository:state.repo,
      handlers:[],
      now:new Date("2026-10-09T18:00:00.000Z"),
    });

    expect(result.activeOwners).toBe(1);
    expect(result.ownersWithDueWork).toBe(1);
    expect(result.blockedOwners).toBe(1);
    expect(result.dispatchedOwners).toBe(0);
    expect(result.missingHandlerKinds).toEqual(["paid_campaign"]);
    expect(state.updates).toEqual([]);
    expect(result.policy.incompleteHandlerCoverageDoesNotMutateActions).toBe(true);
  });

  it("dispatches through the restart-safe scheduler only when every due kind has a handler",async()=>{
    const state=fakeRepository(
      ["user:one"],
      {"user:one":[row("user:one","organic:1","organic_publication")]},
    );
    const handlers:WeeklyActionExecutionHandler[]=[{
      supports:(kind)=>kind==="organic_publication",
      async execute(){
        return {state:"completed",externalReceiptRefs:["provider:post:1"]};
      },
    }];
    const result=await runProtectedWeeklySocialWorker({
      repository:state.repo,
      handlers,
      now:new Date("2026-10-09T18:00:00.000Z"),
    });

    expect(result.dispatchedOwners).toBe(1);
    expect(result.blockedOwners).toBe(0);
    expect(result.ownerReceipts[0]?.scheduler?.completed).toBe(1);
    expect(state.updates.map((update)=>update.status))
      .toEqual(["running","completed"]);
  });

  it("does not partially dispatch an owner when one due kind is still uncommissioned",async()=>{
    const state=fakeRepository(
      ["user:one"],
      {"user:one":[
        row("user:one","organic:1","organic_publication"),
        row("user:one","comment:1","public_comment"),
      ]},
    );
    const handlers:WeeklyActionExecutionHandler[]=[{
      supports:(kind)=>kind==="organic_publication",
      async execute(){return {state:"completed"};},
    }];
    const result:WeeklyProtectedWorkerReceipt=
      await runProtectedWeeklySocialWorker({
        repository:state.repo,
        handlers,
        now:new Date("2026-10-09T18:00:00.000Z"),
      });

    expect(result.blockedOwners).toBe(1);
    expect(result.ownerReceipts[0]?.missingHandlerKinds)
      .toEqual(["public_comment"]);
    expect(state.updates).toEqual([]);
  });

  it("ignores active owners that have no due work",async()=>{
    const state=fakeRepository(["user:one"],{"user:one":[]});
    const result=await runProtectedWeeklySocialWorker({
      repository:state.repo,
      handlers:[],
      now:new Date("2026-10-09T18:00:00.000Z"),
    });

    expect(result.activeOwners).toBe(1);
    expect(result.ownersWithDueWork).toBe(0);
    expect(result.dueActions).toBe(0);
  });
});
