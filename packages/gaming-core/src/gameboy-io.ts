export interface GameBoyVideoFrame {
  width: number;
  height: number;
  pixels: Uint8Array;
}

export interface GameBoyAudioChunk {
  sampleRate: number;
  channels: number;
  samples: Float32Array;
}

export interface GameBoyIoHost {
  presentFrame(frame: GameBoyVideoFrame): void;
  playAudio(chunk: GameBoyAudioChunk): void;
}

export function validateGameBoyFrame(frame: GameBoyVideoFrame): void {
  if (frame.width !== 160 || frame.height !== 144) throw new Error('Game Boy frame must be 160x144');
  if (frame.pixels.length === 0) throw new Error('Game Boy frame pixels are required');
}

export function validateGameBoyAudio(chunk: GameBoyAudioChunk): void {
  if (chunk.sampleRate <= 0) throw new Error('Audio sample rate must be positive');
  if (chunk.channels <= 0) throw new Error('Audio channel count must be positive');
}
