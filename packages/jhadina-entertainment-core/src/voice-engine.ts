export interface VoiceRenderRequest {
  text: string;
  voiceId: string;
  rate: number;
  pitch: number;
  energy: number;
  delivery: 'neutral' | 'warm' | 'playful' | 'dry' | 'sharp' | 'serious' | 'excited';
  pausesMs?: number[];
  emphasis?: string[];
}

export interface VoiceAudio {
  mimeType: string;
  data: Uint8Array;
  durationMs?: number;
  engine: string;
}

export interface VoiceEngine {
  synthesize(request: VoiceRenderRequest): Promise<VoiceAudio>;
}

/** Renderer-neutral boundary. Coqui TTS, Voicebox engines, or another local renderer can implement this contract. */
export class DelegatingVoiceEngine implements VoiceEngine {
  constructor(
    private readonly renderer: (request: VoiceRenderRequest) => Promise<VoiceAudio>,
    private readonly engineName = 'local-voice-engine',
  ) {}

  synthesize(request: VoiceRenderRequest): Promise<VoiceAudio> {
    return this.renderer(request).then((audio) => ({ ...audio, engine: audio.engine || this.engineName }));
  }
}
