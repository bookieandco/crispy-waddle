import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const schema=readFileSync(
  new URL("../../../../../ops/sql/SOCIAL-ID-26-ISOLATED-REHEARSAL-NOT-APPLIED.sql",import.meta.url),
  "utf8",
);
const drill=readFileSync(
  new URL("../../../../../ops/sql/SOCIAL-ID-26-ISOLATED-DRILL-ROLLBACK.sql",import.meta.url),
  "utf8",
);
describe("SOCIAL-ID.26 isolated SQL source contract (NOT actual Postgres certification)",()=>{
  it("never targets live Social tables, production migrations or privileged API grants",()=>{
    expect(schema).toContain("create schema if not exists social_id26_rehearsal");
    expect(schema).toContain("revoke all on schema social_id26_rehearsal from public");
    expect(schema).toContain("security invoker");
    expect(schema.toLowerCase()).not.toContain("security definer");
    expect(schema).not.toMatch(/\bcreate\s+table\s+public\./i);
    expect(schema).not.toMatch(/\bgrant\s+(?:all|execute|insert|update|delete)\s+on\s+.*\bto\s+(?:public|anon|authenticated|service_role)/i);
    expect(schema).not.toMatch(/\bexecute\s+format\s*\(/i);
  });
  it("requires trusted canonical identity and packet lock before receipt consumption",()=>{
    expect(schema).toContain("for update;");
    expect(schema).toContain("assert_current_identities(p_owner,v_packet.account_bindings)");
    expect(schema).toContain("ID26_STALE_OR_FOREIGN_IDENTITY");
    expect(schema).toContain("ID26_PARENT_IDEMPOTENCY_CONFLICT");
    expect(schema).toContain("ID26_CHILD_IDEMPOTENCY_CONFLICT");
    expect(schema).toContain("status='consumed'");
    expect(schema).toContain("status='approved'");
    expect(schema).toContain("ID26_CHILD_PARENT_NOT_CONSUMED");
    expect(schema).toContain("ID26_CHILD_APPROVAL_INVALID");
    expect(schema).toContain("p_proposal->>'canDispatch' is distinct from 'false'");
    expect(schema).toContain("p_batch->>'canPublish' is distinct from 'false'");
    expect(schema).not.toContain("<>");
  });
  it("runs drill fixtures inside transaction, always rolls back, and tests denial/replay",()=>{
    expect(drill).toMatch(/\bbegin;\s*do\s+\$test\$/i);
    expect(drill.trim()).toContain("rollback;");
    expect(drill).toContain("ID26_TEST_FOREIGN_OWNER_ALLOWED");
    expect(drill).toContain("ID26_TEST_PARENT_AUTHORITY_ESCALATION");
    expect(drill).toContain("ID26_TEST_CHILD_PENDING_APPROVAL_ALLOWED");
    expect(drill).toContain("ID26_TEST_IDENTITY_DRIFT_ALLOWED");
    expect(drill).toContain("ID26_TEST_REPLAY_AUTHORITY_ESCALATION");
    expect(drill).toContain("ID26_TEST_DUPLICATE_PARENT");
    expect(drill).toContain("ID26_TEST_DUPLICATE_CHILD");
    expect(drill).not.toContain("commit;");
  });
});
