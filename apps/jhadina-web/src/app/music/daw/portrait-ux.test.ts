import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("./page.tsx",import.meta.url),"utf8");

describe("owner iPhone portrait DAW source regression",()=>{
  it("does not block portrait users behind a full-screen landscape demand",()=>{
    expect(source).not.toContain("Rotate to landscape");
    expect(source).not.toContain("Continue portrait temporarily");
    expect(source).toContain("Portrait editor: swipe sideways");
  });
  it("guards private unsaved edits against project switch and in-flight save receipt races",()=>{
    expect(source).toContain("savingRef.current");
    expect(source).toContain("discard those edits?");
    expect(source).toContain("discard your unsaved DAW edits?");
    expect(source).toContain('value={caseId} disabled={busy}');
    expect(source).toContain('window.addEventListener("beforeunload",warn)');
  });
  it("contains a bounded scroll region and accessible channel inspector anchor",()=>{
    expect(source).toContain('aria-label="Scrollable waveform timeline"');
    expect(source).toContain('role="region"');
    expect(source).toContain('href="#daw-inspector"');
    expect(source).toContain('id="daw-inspector"');
    expect(source).toContain("sm:w-[200px]");
    expect(source).toContain("w-[112px]");
  });
});
