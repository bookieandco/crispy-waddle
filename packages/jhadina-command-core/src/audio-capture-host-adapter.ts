import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { AudioCapturePort, AudioCaptureRequest, AudioFrame } from "./audio-capture-port";

const execFileAsync = promisify(execFile);

export interface MacOSAudioCaptureOptions {
  command?: string;
  input?: string;
}

/** Native macOS microphone bridge. Requires Microphone permission and ffmpeg. */
export class MacOSAudioCaptureAdapter implements AudioCapturePort {
  constructor(private readonly options: MacOSAudioCaptureOptions = {}) {}

  async capture(request: AudioCaptureRequest = {}): Promise<AudioFrame> {
    const directory = await mkdtemp(join(tmpdir(), "jhadina-audio-"));
    const output = join(directory, "capture.wav");
    const durationMs = Math.max(250, Math.min(request.durationMs ?? 5000, 60000));
    const sampleRate = request.sampleRate ?? 16000;
    const channels = request.channels ?? 1;
    const input = request.device ?? this.options.input ?? ":default";
    const args = ["-y", "-f", "avfoundation", "-i", input, "-t", String(durationMs / 1000), "-ar", String(sampleRate), "-ac", String(channels), output];

    try {
      await execFileAsync(this.options.command ?? "ffmpeg", args);
      const audio = (await readFile(output)).toString("base64");
      return {
        capturedAt: new Date().toISOString(),
        durationMs,
        sampleRate,
        channels,
        mediaType: "audio/wav",
        audio,
      };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
