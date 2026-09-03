import type { Vst3ProcessorHandle } from "./vst3-instantiation.js";

export type Vst3ProcessorState =
  | "INSTANTIATED"
  | "INITIALIZED"
  | "CONFIGURED"
  | "ACTIVE"
  | "PROCESSING"
  | "STOPPED"
  | "DEACTIVATED"
  | "RELEASED";

export interface Vst3ProcessorConfiguration {
  sampleRate: number;
  maxSamplesPerBlock: number;
  sampleFormat: "f32" | "f64";
  inputChannels: number;
  outputChannels: number;
}

export interface Vst3ProcessorLifecycleHost {
  initialize(): Promise<void>;
  setupProcessing(configuration: Vst3ProcessorConfiguration): Promise<void>;
  setBusArrangements(inputChannels: number, outputChannels: number): Promise<void>;
  setActive(active: boolean): Promise<void>;
  setProcessing(processing: boolean): Promise<void>;
  process(sampleOffset: number, numSamples: number): Promise<void>;
  terminate(): Promise<void>;
}

export class Vst3ProcessorLifecycle {
  private state: Vst3ProcessorState = "INSTANTIATED";

  constructor(
    private readonly host: Vst3ProcessorLifecycleHost,
    private readonly handle: Vst3ProcessorHandle,
  ) {}

  getState(): Vst3ProcessorState {
    return this.state;
  }

  async initialize(): Promise<void> {
    this.require("INSTANTIATED");
    await this.host.initialize();
    this.state = "INITIALIZED";
  }

  async configure(configuration: Vst3ProcessorConfiguration): Promise<void> {
    this.require("INITIALIZED");
    if (!Number.isFinite(configuration.sampleRate) || configuration.sampleRate <= 0) throw new Error("VST3 sample rate is invalid");
    if (!Number.isInteger(configuration.maxSamplesPerBlock) || configuration.maxSamplesPerBlock <= 0) throw new Error("VST3 max block size is invalid");
    if (!Number.isInteger(configuration.inputChannels) || configuration.inputChannels < 0) throw new Error("VST3 input channel count is invalid");
    if (!Number.isInteger(configuration.outputChannels) || configuration.outputChannels < 0) throw new Error("VST3 output channel count is invalid");
    await this.host.setupProcessing(configuration);
    await this.host.setBusArrangements(configuration.inputChannels, configuration.outputChannels);
    this.state = "CONFIGURED";
  }

  async activate(): Promise<void> {
    this.require("CONFIGURED");
    await this.host.setActive(true);
    this.state = "ACTIVE";
  }

  async startProcessing(): Promise<void> {
    this.require("ACTIVE");
    await this.host.setProcessing(true);
    this.state = "PROCESSING";
  }

  async process(sampleOffset: number, numSamples: number, maxSamplesPerBlock: number): Promise<void> {
    this.require("PROCESSING");
    if (!Number.isInteger(sampleOffset) || sampleOffset < 0) throw new Error("VST3 sample offset is invalid");
    if (!Number.isInteger(numSamples) || numSamples <= 0 || numSamples > maxSamplesPerBlock) throw new Error("VST3 process block exceeds authorized maximum");
    await this.host.process(sampleOffset, numSamples);
  }

  async stopProcessing(): Promise<void> {
    this.require("PROCESSING");
    await this.host.setProcessing(false);
    this.state = "STOPPED";
  }

  async deactivate(): Promise<void> {
    this.require("STOPPED");
    await this.host.setActive(false);
    this.state = "DEACTIVATED";
  }

  async release(): Promise<void> {
    if (this.state !== "DEACTIVATED") throw new Error(`VST3 lifecycle requires DEACTIVATED, got ${this.state}`);
    try {
      await this.host.terminate();
    } finally {
      await this.handle.release();
      this.state = "RELEASED";
    }
  }

  private require(expected: Vst3ProcessorState): void {
    if (this.state !== expected) throw new Error(`VST3 lifecycle requires ${expected}, got ${this.state}`);
  }
}
