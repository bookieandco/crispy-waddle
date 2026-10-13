-- SOCIAL-ID.26 ISOLATED REHEARSAL: run only after creating isolated schema.
-- psql -v ON_ERROR_STOP=1 -f ops/sql/SOCIAL-ID-26-ISOLATED-REHEARSAL-NOT-APPLIED.sql
-- psql -v ON_ERROR_STOP=1 -f ops/sql/SOCIAL-ID-26-ISOLATED-DRILL-ROLLBACK.sql
-- All fixture mutations below are enclosed in a transaction that ROLLS BACK.
begin;
do $test$
declare
 v_owner uuid:='11111111-1111-4111-8111-111111111111';
 v_foreign uuid:='22222222-2222-4222-8222-222222222222';
 v_parent uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 v_child_receipt uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 v_child jsonb;
 v_batch jsonb;
 v_outbox jsonb;
 v_result jsonb;
 v_count integer;
 v_denied boolean;
begin
 v_child:=jsonb_build_object(
  'actionId','organic-a','actionKind','organic_publication',
  'campaignId','campaign-a','brand','pupsonstuff',
  'actionFingerprint','post-fp','weeklyReviewFingerprint','weekly-fp',
  'requiresIndependentActionPermit',true,'canExecute',false,
  'state','AWAITING_INDEPENDENT_ACTION_PERMIT'
 );
 v_batch:=jsonb_build_object(
  'schema','jhadina.social.weekly-child-batch.v1',
  'ownerUserId',v_owner::text,'packetId','packet-a',
  'approvalReceiptId',v_parent::text,'packetFingerprint','packet-fp',
  'compositeFingerprint','weekly-fp',
  'validUntil','2099-01-01T00:00:00Z',
  'children',jsonb_build_array(v_child),
  'state','PERSISTED_REVIEW_ONLY',
  'canExecute',false,'canPublish',false,'canComment',false,'canSpend',false
 );
 v_outbox:=jsonb_build_object(
  'schema','jhadina.social.weekly-child-outbox.v1',
  'ownerUserId',v_owner::text,'packetId','packet-a',
  'childActionId','organic-a','actionKind','organic_publication',
  'approvalReceiptId',v_child_receipt::text,
  'parentApprovalReceiptId',v_parent::text,'actionId','weekly-child:packet-a:organic-a:hash',
  'capability','public.publish','fingerprint','child-auth-fp',
  'childFingerprint','post-fp','reviewedWeeklyFingerprint','weekly-fp',
  'state','AWAITING_DISPATCH_CERTIFICATION',
  'requiresFreshActionSecurityPermit',true,'canDispatch',false,'canExecute',false
 );
 insert into social_id26_rehearsal.identities
   (owner_id,account_id,version,identity_fingerprint)
 values(v_owner,'account-a',1,'identity-v1');
 insert into social_id26_rehearsal.packets
   (owner_id,packet_id,packet_fingerprint,composite_fingerprint,expires_at,account_bindings,child_specs)
 values(v_owner,'packet-a','packet-fp','weekly-fp','2099-01-01T00:00:00Z',
   '[{"accountId":"account-a","identityVersion":1,"identityFingerprint":"identity-v1"}]'::jsonb,
   jsonb_build_array(v_child));
 insert into social_id26_rehearsal.receipts
   (id,owner_id,action_id,capability,fingerprint,status,expires_at)
 values
   (v_parent,v_owner,'social-weekly:packet-a:hash','social.weekly.review','weekly-fp','approved','2099-01-01'),
   (v_child_receipt,v_owner,'weekly-child:packet-a:organic-a:hash',
       'public.publish','child-auth-fp','approved','2099-01-01');

 -- No owner-foreign packet or identity access even in the rehearsal function.
 v_denied:=false;
 begin
   perform social_id26_rehearsal.stage_parent(
     v_foreign,'packet-a',v_parent,'social-weekly:packet-a:hash',
     'social.weekly.review','weekly-fp',v_batch);
 exception when others then
   if sqlerrm='ID26_PARENT_STALE_PACKET' then v_denied:=true; else raise; end if;
 end;
 if not v_denied then raise exception 'ID26_TEST_FOREIGN_OWNER_ALLOWED'; end if;

 -- Strict payload checks reject changed approval authority before receipt use.
 v_denied:=false;
 begin
   perform social_id26_rehearsal.stage_parent(
     v_owner,'packet-a',v_parent,'social-weekly:packet-a:hash',
     'social.weekly.review','weekly-fp',
     jsonb_set(v_batch,'{canPublish}','true'::jsonb));
 exception when others then
   if sqlerrm='ID26_PARENT_PAYLOAD_MISMATCH' then v_denied:=true; else raise; end if;
 end;
 if not v_denied then raise exception 'ID26_TEST_PARENT_AUTHORITY_ESCALATION'; end if;

 v_result:=social_id26_rehearsal.stage_parent(
   v_owner,'packet-a',v_parent,'social-weekly:packet-a:hash',
   'social.weekly.review','weekly-fp',v_batch);
 if v_result is distinct from v_batch then raise exception 'ID26_TEST_PARENT_BAD_RESULT'; end if;
 -- Simulate a lost HTTP response: exact retry must be idempotent.
 if social_id26_rehearsal.stage_parent(
   v_owner,'packet-a',v_parent,'social-weekly:packet-a:hash',
   'social.weekly.review','weekly-fp',v_batch) is distinct from v_batch
 then raise exception 'ID26_TEST_PARENT_REPLAY_WRONG'; end if;
 if (select status from social_id26_rehearsal.receipts where id=v_parent)<>'consumed'
 then raise exception 'ID26_TEST_PARENT_RECEIPT_NOT_CONSUMED'; end if;

 -- Identity version drift must stop child staging even after parent approval.
 update social_id26_rehearsal.identities set version=2
 where owner_id=v_owner and account_id='account-a';
 v_denied:=false;
 begin
   perform social_id26_rehearsal.stage_child(
     v_owner,'packet-a','organic-a',v_child_receipt,
     'weekly-child:packet-a:organic-a:hash','public.publish','child-auth-fp',
     v_parent,'weekly-fp','post-fp',v_outbox);
 exception when others then
   if sqlerrm='ID26_STALE_OR_FOREIGN_IDENTITY' then v_denied:=true; else raise; end if;
 end;
 if not v_denied then raise exception 'ID26_TEST_IDENTITY_DRIFT_ALLOWED'; end if;
 update social_id26_rehearsal.identities set version=1
 where owner_id=v_owner and account_id='account-a';

 -- Independent child receipt MUST already be approved.
 update social_id26_rehearsal.receipts set status='pending' where id=v_child_receipt;
 v_denied:=false;
 begin
   perform social_id26_rehearsal.stage_child(
     v_owner,'packet-a','organic-a',v_child_receipt,
     'weekly-child:packet-a:organic-a:hash','public.publish','child-auth-fp',
     v_parent,'weekly-fp','post-fp',v_outbox);
 exception when others then
   if sqlerrm='ID26_CHILD_APPROVAL_INVALID' then v_denied:=true; else raise; end if;
 end;
 if not v_denied then raise exception 'ID26_TEST_CHILD_PENDING_APPROVAL_ALLOWED'; end if;
 update social_id26_rehearsal.receipts set status='approved' where id=v_child_receipt;

 v_result:=social_id26_rehearsal.stage_child(
   v_owner,'packet-a','organic-a',v_child_receipt,
   'weekly-child:packet-a:organic-a:hash','public.publish','child-auth-fp',
   v_parent,'weekly-fp','post-fp',v_outbox);
 if v_result is distinct from v_outbox then raise exception 'ID26_TEST_CHILD_BAD_RESULT'; end if;
 if social_id26_rehearsal.stage_child(
   v_owner,'packet-a','organic-a',v_child_receipt,
   'weekly-child:packet-a:organic-a:hash','public.publish','child-auth-fp',
   v_parent,'weekly-fp','post-fp',v_outbox) is distinct from v_outbox
 then raise exception 'ID26_TEST_CHILD_REPLAY_WRONG'; end if;
 if (select status from social_id26_rehearsal.receipts where id=v_child_receipt)<>'consumed'
 then raise exception 'ID26_TEST_CHILD_RECEIPT_NOT_CONSUMED'; end if;

 v_denied:=false;
 begin
   perform social_id26_rehearsal.stage_child(
     v_owner,'packet-a','organic-a',v_child_receipt,
     'weekly-child:packet-a:organic-a:hash','public.publish','child-auth-fp',
     v_parent,'weekly-fp','post-fp',
     jsonb_set(v_outbox,'{canDispatch}','true'::jsonb));
 exception when others then
   if sqlerrm='ID26_CHILD_PAYLOAD_MISMATCH' then v_denied:=true; else raise; end if;
 end;
 if not v_denied then raise exception 'ID26_TEST_REPLAY_AUTHORITY_ESCALATION'; end if;

 select count(*) into v_count from social_id26_rehearsal.batches where owner_id=v_owner;
 if v_count<>1 then raise exception 'ID26_TEST_DUPLICATE_PARENT'; end if;
 select count(*) into v_count from social_id26_rehearsal.outbox where owner_id=v_owner;
 if v_count<>1 then raise exception 'ID26_TEST_DUPLICATE_CHILD'; end if;
 raise notice 'SOCIAL-ID.26 isolated in-transaction checks PASSED; rolling back fixtures';
end;
$test$;
rollback;
-- The schema persists in this isolated rehearsal database by design;
-- fixture data MUST NOT persist. To destroy it: DROP SCHEMA ... CASCADE
-- on the disposable database ONLY, after verifying the server target.
