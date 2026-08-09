// lib/ascii.ts
//
// Server-only image processing (uses `sharp`, a native module — never
// import this from a client component).
//
// The "ASCII Art" style, unlike every other art style, isn't generative
// AI at all — it's the same idea as vietnh1009/ASCII-generator (a
// deterministic pixel-brightness → character mapping), reimplemented
// natively here in TypeScript rather than pulled in as a Python
// dependency, matching the same "use the JS/TS equivalent" call already
// made for lib/ai.ts (OpenAI SDK) and lib/animation.ts (Hugging Face
// SDK). Real difference worth knowing: because this is pure computation
// with no external API call, it needs no API key and is the one
// generation path in this project that's actually testable end-to-end in
// this environment — verified for real, not just structurally.

import sharp from "sharp";

// Light-to-dark ramp. Order matters — index scales with brightness below.
const ASCII_RAMP = " .:-=+*#%@";

export interface AsciiArtOptions {
  /** characters across the grid — taller grids cost more render time, not accuracy */
  columns?: number;
  /** output PNG is square, this many pixels per side */
  outputSize?: number;
  /** background fill */
  backgroundColor?: string;
  /** character fill */
  foregroundColor?: string;
}

const DEFAULTS: Required<AsciiArtOptions> = {
  columns: 90,
  outputSize: 1024,
  backgroundColor: "#171716", // ink, matches tailwind.config.ts
  foregroundColor: "#EED8BE", // cream, matches tailwind.config.ts
};

function escapeXml(ch: string): string {
  return ch.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Converts a photo into a real ASCII-art image: samples brightness on a
 * character grid, maps each cell to a character from ASCII_RAMP, and
 * rasterizes the result as an actual PNG (via an SVG intermediate —
 * sharp rasterizes SVG natively, which avoids needing a native canvas
 * library just to draw monospace text).
 */
export async function imageToAsciiArt(
  imageBuffer: Buffer,
  options: AsciiArtOptions = {}
): Promise<Buffer> {
  const { columns, outputSize, backgroundColor, foregroundColor } = {
    ...DEFAULTS,
    ...options,
  };

  // Monospace characters are roughly twice as tall as they are wide, so
  // sampling a square grid would vertically stretch the result — halve
  // the row count relative to columns to compensate.
  const rows = Math.max(1, Math.round(columns * 0.5));

  const { data } = await sharp(imageBuffer)
    .resize(columns, rows, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cellW = outputSize / columns;
  const cellH = outputSize / rows;
  const fontSize = Math.min(cellW, cellH) * 1.4;

  let glyphs = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const luminance = data[y * columns + x]; // 0 (black) .. 255 (white)
      // Dark pixels get "denser" characters (higher index = more ink).
      const rampIndex = Math.round(
        ((255 - luminance) / 255) * (ASCII_RAMP.length - 1)
      );
      const ch = ASCII_RAMP[rampIndex];
      if (ch === " ") continue;
      const cx = x * cellW + cellW / 2;
      const cy = y * cellH + cellH * 0.75; // baseline offset, not vertical-center
      glyphs += `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="${fontSize.toFixed(1)}" fill="${foregroundColor}" text-anchor="middle">${escapeXml(ch)}</text>`;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outputSize}" height="${outputSize}">
    <rect width="100%" height="100%" fill="${backgroundColor}"/>
    ${glyphs}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
