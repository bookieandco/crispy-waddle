"use client";

import { Product3DPlugin } from "@/lib/product3d/types";
import { captureCanvasScreenshot, downloadDataUrl } from "@/lib/product3d/screenshot";

/**
 * Roadmap item 5 (screenshot/export service) implemented as a plugin,
 * doubling as the proof that item 6 (plugin architecture) is real rather
 * than just an empty interface. A future text-to-3D or AR capability would
 * plug in the same way — contribute a renderControls button, read from the
 * same Product3DPluginContext.
 */
export const screenshotPlugin: Product3DPlugin = {
  id: "screenshot-export",
  renderControls: ({ config, canvasElement }) => (
    <button
      type="button"
      onClick={() => {
        if (!canvasElement) return;
        const dataUrl = captureCanvasScreenshot(canvasElement, { scale: 2 });
        downloadDataUrl(dataUrl, `${config.id}-preview.png`);
      }}
      className="rounded-md border border-honey-oak px-3 py-1.5 text-xs font-medium text-bronze transition hover:bg-honey-oak hover:text-cream"
    >
      Download High-Res Preview
    </button>
  ),
};
