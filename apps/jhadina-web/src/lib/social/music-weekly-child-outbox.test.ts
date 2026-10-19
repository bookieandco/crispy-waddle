import {describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {
  createSupabaseWeeklyChildOutboxStore,
  decodeWeeklyChildOutboxRow,
} from './supabase-weekly-child-outbox-store';

const record={
  schema:'jhadina.social.weekly-child-outbox.v1',
  ownerUserId:'owner1',packetId:'packet1',
  childActionId:'music-child1',actionKind:'organic_publication',
  capability:'public.publish',
  actionId:'weekly-child:packet1:music-child1:sha',
  fingerprint:'owner-packet-child-fingerprint',
  approvalReceiptId:'independent-child-approval',
  parentApprovalReceiptId:'weekly-parent-approval',
  reviewedWeeklyFingerprint:'weekly-composite-fingerprint',
  childFingerprint:'immutable-action-fingerprint',
  state:'AWAITING_DISPATCH_CERTIFICATION',
  requiresFreshActionSecurityPermit:true,
  canDispatch:false,
  canExecute:false,
} as const;

describe('MUSIC-FINISH child approval source admission (not dispatch)',()=>{
  it('reconstructs only an inert, fully scoped child approval receipt',()=>{
    const value=decodeWeeklyChildOutboxRow(record);
    expect(value.canDispatch).toBe(false);
    expect(value.canExecute).toBe(false);
    expect(value.parentApprovalReceiptId).toBe('weekly-parent-approval');
    expect(value.approvalReceiptId).toBe('independent-child-approval');
    expect(()=>decodeWeeklyChildOutboxRow({...record,canDispatch:true})).toThrow();
    expect(()=>decodeWeeklyChildOutboxRow({...record,canExecute:true})).toThrow();
    expect(()=>decodeWeeklyChildOutboxRow({...record,capability:'paid-ad.publish'})).toThrow();
  });
  it('never touches Supabase if the atomic child store is not commissioned',async()=>{
    const rpc=vi.fn();
    const client={rpc} as unknown as SupabaseClient;
    const store=createSupabaseWeeklyChildOutboxStore({
      client,verifiedOwnerUserId:'owner1',commissioned:false,
    });
    await expect(store.consumeApprovalAndStageChild({
      proposed:record,
      expectedOwnerUserId:'owner1',
      expectedReceiptActionId:record.actionId,
      expectedReceiptType:'public.publish',
      expectedReceiptFingerprint:record.fingerprint,
      expectedParentReceiptId:record.parentApprovalReceiptId,
      expectedPacketFingerprint:record.reviewedWeeklyFingerprint,
      expectedChildFingerprint:record.childFingerprint,
    })).rejects.toThrow('NOT_COMMISSIONED');
    expect(rpc).not.toHaveBeenCalled();
  });
});
