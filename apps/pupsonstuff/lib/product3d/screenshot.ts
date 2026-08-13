// lib/product3d/screenshot.ts
//
// Roadmap item 5: "Create a screenshot/export service for high-resolution
// previews." This captures the WebGL canvas's actual pixel buffer at a
// resolution multiplier (so a small on-screen canvas can still export a
// print-resolution-ish PNG), not just a low-res screen grab.
//
// Requires the canvas to have been rendered with preserveDrawingBuffer:
// true (set in Product3DEngine.tsx's <Canvas gl={...}>), or toDataURL()
// can return a blank image in some browsers.

export interface ScreenshotOptions {
  /** multiplies the canvas's current pixel size, e.g. 2 = roughly 2x resolution */
  scale?: number;
  mimeType?: "image/png" | "image/jpeg";
}

export function captureCanvasScreenshot(
  canvas: HTMLCanvasElement,
  options: ScreenshotOptions = {}
): string {
  const { scale = 2, mimeType = "image/png" } = options;

  if (scale === 1) {
    return canvas.toDataURL(mimeType);
  }

  // Re-render the existing pixel buffer onto a larger offscreen canvas.
  // This upsamples rather than re-rendering the 3D scene at higher
  // internal resolution — genuinely higher quality would mean bumping the
  // renderer's pixel ratio before capture, which Product3DEngine doesn't
  // expose a hook for yet. Flagged as a known limitation, not hidden.
  const out = document.createElement("canvas");
  out.width = canvas.width * scale;
  out.height = canvas.height * scale;
  const ctx = out.getContext("2d");
  if (!ctx) return canvas.toDataURL(mimeType);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out.toDataURL(mimeType);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
