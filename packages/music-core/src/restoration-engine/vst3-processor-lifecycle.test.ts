import assert from "node:assert/strict";
import test from "node:test";
import { Vst3ProcessorLifecycle, type Vst3ProcessorConfiguration } from "./vst3-processor-lifecycle.js";

const configuration: Vst3ProcessorConfiguration = {
  sampleRate: 48000,
  maxSamplesPerBlock: 512,
  sampleFormat: "f32",
  inputChannels: 2,
  outputChannels: 2,
};

function fixture() {
  const calls: string[] = [];
  const host = {
    initialize: async () => calls.push("initialize"),
    setupProcessing: async (_: Vst3ProcessorConfiguration) => calls.push("setupProcessing"),
    setBusArrangements: async () => calls.push("setBusArrangements"),
    setActive: async (active: boolean) => calls.push(`setActive:${active}`),
    setProcessing: async (processing: boolean) => calls.push(`setProcessing:${processing}`),
    process: async () => calls.push("process"),
    terminate: async () => calls.push("terminate"),
  };
  const handle = { release: async () => calls.push("release") };
  return { lifecycle: new Vst3ProcessorLifecycle(host, handle), calls };
}

test("enforces the VST3 processing lifecycle ordering", async () => {
  const { lifecycle, calls } = fixture();
  await lifecycle.initialize();
  await lifecycle.configure(configuration);
  await lifecycle.activate();
  await lifecycle.startProcessing();
  await lifecycle.process(0, 256);
  await lifecycle.stopProcessing();
  await lifecycle.deactivate();
  await lifecycle.release();
  assert.deepEqual(calls, [
    "initialize", "setupProcessing", "setBusArrangements", "setActive:true",
    "setProcessing:true", "process", "setProcessing:false", "setActive:false",
    "terminate", "release",
  ]);
  assert.equal(lifecycle.getState(), "RELEASED");
});

test("rejects processing before activation and processing start", async () => {
  const { lifecycle } = fixture();
  await assert.rejects(() => lifecycle.process(0, 1));
  await lifecycle.initialize();
  await lifecycle.configure(configuration);
  await lifecycle.activate();
  await assert.rejects(() => lifecycle.process(0, 1));
});

test("rejects blocks larger than the configured maximum", async () => {
  const { lifecycle } = fixture();
  await lifecycle.initialize();
  await lifecycle.configure(configuration);
  await lifecycle.activate();
  await lifecycle.startProcessing();
  await assert.rejects(() => lifecycle.process(0, 513));
});

test("rejects invalid sample formats and preserves configuration authority", async () => {
  const { lifecycle } = fixture();
  await lifecycle.initialize();
  await assert.rejects(() => lifecycle.configure({ ...configuration, sampleFormat: "invalid" as never }));
  await lifecycle.configure(configuration);
  await lifecycle.activate();
  await lifecycle.startProcessing();
  await assert.rejects(() => lifecycle.process(0, 513));
});

test("release requires clean processing shutdown", async () => {
  const { lifecycle } = fixture();
  await lifecycle.initialize();
  await lifecycle.configure(configuration);
  await lifecycle.activate();
  await assert.rejects(() => lifecycle.release());
});
