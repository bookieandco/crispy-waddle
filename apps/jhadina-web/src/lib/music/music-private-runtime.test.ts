import {afterEach,describe,expect,it,vi} from "vitest";
import {previewMusicIsolationReady,createMusicPrototypePrivilegedClient}
  from "./music-private-runtime";
import {createRuntimeServiceRoleClient} from "@/lib/supabase/service-role";

vi.mock("@/lib/supabase/service-role",()=>({
  createRuntimeServiceRoleClient:vi.fn(async()=>({privateClient:true})),
}));
afterEach(()=>vi.unstubAllEnvs());
const setup=()=>{
  vi.stubEnv("VERCEL_ENV","preview");
  vi.stubEnv("VERCEL_PROJECT_ID","prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco");
  vi.stubEnv("VERCEL_GIT_COMMIT_REF","music-prototype-live-06-09-20261020");
  vi.stubEnv("MUSIC_PREVIEW_ISOLATED_PROJECT_REF","abcdefghijklmnopqrst");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://abcdefghijklmnopqrst.supabase.co");
  vi.stubEnv("SUPABASE_URL","https://abcdefghijklmnopqrst.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","preview-isolated-placeholder");
};
describe("music prototype isolated preview credential gate",()=>{
  it("never connects ordinary preview to recovered production Swlc",async()=>{
    setup();
    vi.stubEnv("MUSIC_PREVIEW_ISOLATED_PROJECT_REF","kqbkaozfjubkjevdfvic");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://kqbkaozfjubkjevdfvic.supabase.co");
    vi.stubEnv("SUPABASE_URL","https://kqbkaozfjubkjevdfvic.supabase.co");
    expect(previewMusicIsolationReady()).toBe(false);
    expect(await createMusicPrototypePrivilegedClient()).toBeNull();
  });
  it("accepts only independently configured, branch-bound isolated preview",async()=>{
    setup();
    expect(previewMusicIsolationReady()).toBe(true);
    expect(await createMusicPrototypePrivilegedClient()).not.toBeNull();
    vi.stubEnv("VERCEL_GIT_COMMIT_REF","untrusted-branch");
    expect(previewMusicIsolationReady()).toBe(false);
    expect(await createMusicPrototypePrivilegedClient()).toBeNull();
  });
  it("does not grant a preview privileged client without dedicated secret",async()=>{
    setup();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","");
    expect(await createMusicPrototypePrivilegedClient()).toBeNull();
  });
  it("preserves the existing production OIDC boundary rather than previewing on production DB",async()=>{
    vi.stubEnv("VERCEL_ENV","production");
    expect(await createMusicPrototypePrivilegedClient()).not.toBeNull();
    expect(createRuntimeServiceRoleClient).toHaveBeenCalled();
  });
});
