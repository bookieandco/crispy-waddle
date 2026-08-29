import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ScreenCapturePort, ScreenCaptureRequest, ScreenFrame } from "./screen-capture-port";

const execFileAsync = promisify(execFile);

export interface MacOSScreenCaptureOptions {
  command?: string;
}

/** Native macOS host implementation. Requires Screen Recording permission. */
export class MacOSScreenCaptureAdapter implements ScreenCapturePort {
  constructor(private readonly options: MacOSScreenCaptureOptions = {}) {}

  async capture(request: ScreenCaptureRequest = {}): Promise<ScreenFrame> {
    const directory = await mkdtemp(join(tmpdir(), "jhadina-screen-"));
    const output = join(directory, "capture.png");
    const args = ["-x"];

    if (request.displayId) args.push("-D", request.displayId);
    if (request.windowId) args.push("-l", request.windowId);
    args.push(output);

    try {
      await execFileAsync(this.options.command ?? "screencapture", args);
      const image = (await readFile(output)).toString("base64");
      return {
        capturedAt: new Date().toISOString(),
        width: 0,
        height: 0,
        mediaType: "image/png",
        image,
      };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
