-- SecurityCore has a third decision state that must remain auditable.
-- Extend the canonical audit table rather than creating a security-specific store.
alter table public.jhadina_audit_event
drop constraint if exists jhadina_audit_event_decision_check;

alter table public.jhadina_audit_event
add constraint jhadina_audit_event_decision_check
check (decision in ('allow', 'deny', 'approval_required'));
