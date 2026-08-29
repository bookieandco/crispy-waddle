import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ScreenCapturePort, ScreenCaptureRequest, ScreenFrame } from "@jhadina/command-core";

export class MacOSScreenCaptureAdapter implements ScreenCapturePort {
  async capture(request: ScreenCaptureRequest = {}): Promise<ScreenFrame> {
    if (request.windowId) {
      throw new Error("macOS windowId capture is not implemented by the native screencapture adapter");
    }

    const dir = await mkdtemp(join(tmpdir(), "jhadina-screen-"));
    const path = join(dir, "frame.png");

    try {
      const args = ["-x", "-t", "png"];
      if (request.displayId) args.push("-D", request.displayId);
      args.push(path);

      await execFileAsync("screencapture", args);
      const image = (await readFile(path)).toString("base64");
      const { width, height } = pngDimensions(image);

      return {
        capturedAt: new Date().toISOString(),
        width,
        height,
        mediaType: "image/png",
        image: `data:image/png;base64,${image}`,
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

function execFileAsync(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, args, (error) => error ? reject(error) : resolve());
  });
}

function pngDimensions(base64: string): { width: number; height: number } {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47 || bytes.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error("Host screen capture did not return a valid PNG");
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}
