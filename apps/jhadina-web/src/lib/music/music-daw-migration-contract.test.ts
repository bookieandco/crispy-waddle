import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../../../../supabase/migrations/20261007194500_music_daw_portable_sessions.sql",
  import.meta.url),"utf8");
describe("pending DAW migration security contract",()=>{
 it("keeps both exposed tables FORCE RLS and writable only through the trusted RPC",()=>{
   expect(sql).toMatch(/alter table public\.music_daw_sessions force row level security/i);
   expect(sql).toMatch(/alter table public\.music_daw_edit_history force row level security/i);
   expect(sql).toMatch(/revoke all on public\.music_daw_sessions from public, anon, authenticated, service_role/i);
   expect(sql).toMatch(/revoke all on public\.music_daw_edit_history from public, anon, authenticated, service_role/i);
   expect(sql).toMatch(/grant execute on function public\.save_music_daw_session\(text,uuid,bigint,text,jsonb\)\s+to service_role/i);
 });
 it("hardens SECURITY DEFINER resolution and refuses stale revision or wrong owner",()=>{
   expect(sql).toMatch(/language plpgsql security definer set search_path = pg_catalog/i);
   expect(sql).not.toContain("auth.role()");
   expect(sql).toContain("MUSIC_DAW_CASE_OWNER_MISMATCH");
   expect(sql).toContain("MUSIC_DAW_REVISION_CONFLICT");
   expect(sql).toContain("pg_advisory_xact_lock");
   expect(sql).toContain("unique(case_id, mutation_id)");
 });
});
