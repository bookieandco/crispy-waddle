import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { AudioFrame } from "./audio-capture-port";

const execFileAsync = promisify(execFile);

export interface WhisperTranscription {
  text: string;
  language?: string;
}

export interface WhisperClient {
  transcribe(audioPath: string, options?: { model?: string; language?: string }): Promise<WhisperTranscription>;
}

/** Provider boundary for OpenAI Whisper. The official implementation accepts audio files and returns text/segments. */
export class WhisperCliClient implements WhisperClient {
  constructor(private readonly command = "whisper") {}

  async transcribe(audioPath: string, options: { model?: string; language?: string } = {}): Promise<WhisperTranscription> {
    const directory = await mkdtemp(join(tmpdir(), "jhadina-whisper-"));
    try {
      const args = [audioPath, "--output_dir", directory, "--output_format", "txt", "--verbose", "False"];
      if (options.model) args.push("--model", options.model);
      if (options.language) args.push("--language", options.language);
      await execFileAsync(this.command, args);
      const base = audioPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "audio";
      const text = (await readFile(join(directory, `${base}.txt`), "utf8")).trim();
      return { text, language: options.language };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

export async function transcribeAudioFrame(
  frame: AudioFrame,
  whisper: WhisperClient,
  options?: { model?: string; language?: string },
): Promise<WhisperTranscription> {
  const directory = await mkdtemp(join(tmpdir(), "jhadina-whisper-input-"));
  const input = join(directory, "capture.wav");
  try {
    await writeFile(input, Buffer.from(frame.audio, "base64"));
    return await whisper.transcribe(input, options);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
