export interface LookPreset {
  id: string;
  label: string;
  filmStock: string;
  lensNotes: string;
  lightingSetup: string;
  compositionRule: string;
  grain: "none" | "subtle" | "moderate" | "heavy";
}

export const lookPresets: Record<string, LookPreset> = {
  "classic-chrome": { id: "classic-chrome", label: "Classic Chrome", filmStock: "muted color, desaturated reds, deep shadow contrast", lensNotes: "35mm prime, f/2.8, natural falloff", lightingSetup: "soft overcast daylight", compositionRule: "rule of thirds", grain: "subtle" },
  "provia-standard": { id: "provia-standard", label: "Provia / Standard", filmStock: "balanced, true-to-life color", lensNotes: "50mm prime, f/4", lightingSetup: "even studio key and fill", compositionRule: "centered", grain: "none" },
  "35mm-portrait": { id: "35mm-portrait", label: "35mm Film Portrait", filmStock: "Kodak Portra 400, warm skin tones, gentle halation", lensNotes: "85mm prime, f/1.8, shallow depth of field", lightingSetup: "golden-hour side light", compositionRule: "leading lines", grain: "moderate" },
  "street-push": { id: "street-push", label: "Street Push-Process", filmStock: "Kodak Tri-X-inspired push-processed contrast, black and white", lensNotes: "28mm prime, f/5.6, deep focus", lightingSetup: "harsh midday sun", compositionRule: "golden ratio", grain: "heavy" },
};

const antiSlopDirectives = [
  "avoid airbrushed or plastic-smooth skin",
  "avoid perfectly symmetrical AI-generated facial features",
  "avoid oversaturated glow or HDR sheen",
  "avoid stray text or watermark artifacts",
];

export function describeLookPreset(preset: LookPreset): string {
  const parts = [`film stock: ${preset.filmStock}`, `lens: ${preset.lensNotes}`, `lighting: ${preset.lightingSetup}`, `composition: ${preset.compositionRule}`, `grain: ${preset.grain}`];
  return `Photographic treatment (${preset.label}) — ${parts.join(", ")}. Avoid: ${antiSlopDirectives.join("; ")}.`;
}

export function applyLookPreset(prompt: string, presetId: string | undefined, catalog: Record<string, LookPreset> = lookPresets): string {
  if (!presetId) return prompt;
  const preset = catalog[presetId];
  if (!preset) return prompt;
  return `${prompt}\n${describeLookPreset(preset)}`;
}
