import {describe,it,expect} from "vitest";
import {estimateBenchmarkAlignment} from "./benchmark-harness.js";
const estimate=(a:Float32Array,b:Float32Array,max=4)=>estimateBenchmarkAlignment(a,b,max);
describe("MUSIC-RESTORE.RECOVER alignment fail-closed",()=>{
  it("abstains on silence and constant sources",()=>{
    expect(estimate(new Float32Array(64),new Float32Array(64))).toMatchObject({candidateDelaySamples:0,confidence:0});
    expect(estimate(new Float32Array(64).fill(.25),new Float32Array(64).fill(.25))).toMatchObject({candidateDelaySamples:0,confidence:0});
  });
  it("abstains on periodic ambiguity",()=>{
    const a=Float32Array.from({length:128},(_,i)=>i%2?1:-1);
    expect(estimate(a,a,10).confidence).toBe(0);
  });
  it("finds a unique shifted transient",()=>{
    const a=new Float32Array(128),b=new Float32Array(128);
    for(let i=32;i<56;i++)a[i]=Math.sin((i-32)*1.13)*(1+(i-32)/40);
    b.set(a.subarray(0,125),3);
    const found=estimate(a,b,6);
    expect(found.candidateDelaySamples).toBe(3);
    expect(found.confidence).toBeGreaterThan(0);
  });
  it("abstains rather than trusting nonfinite values",()=>{
    const a=new Float32Array(64),b=new Float32Array(64);
    a[20]=1;b[20]=Number.NaN;
    expect(estimate(a,b).confidence).toBe(0);
  });
});
