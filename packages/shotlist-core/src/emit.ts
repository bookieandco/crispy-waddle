import type { DirectorControls, Entity, ReferenceAsset, Shot } from "./types.js";

export interface PromptContext {
  shot: Shot;
  prefix?: string;
  refs?: ReferenceAsset[];
  entities?: Entity[];
}

export interface PromptTarget {
  name: string;
  render(ctx: PromptContext): string;
}

function lockedTraitsFor(ctx: PromptContext): string[] {
  const handles = new Set(ctx.shot.entityHandles);
  return (ctx.entities ?? [])
    .filter((entity) => handles.has(entity.id) || handles.has(entity.name))
    .flatMap((entity) => entity.lockedTraits);
}

function referenceUrisFor(ctx: PromptContext): string[] {
  const handles = new Set(ctx.shot.entityHandles);
  return (ctx.refs ?? [])
    .filter((ref) => handles.has(ref.entityId))
    .map((ref) => ref.uri);
}

/**
 * Renders `DirectorControls` as a single instruction line. Returns
 * `undefined` when there is nothing to say, so callers can omit the line
 * entirely rather than emitting an empty "Director:" fragment — the
 * "degrade gracefully" half of the spec.
 */
function directorInstructions(director: DirectorControls | undefined): string | undefined {
  if (!director) return undefined;
  const parts: string[] = [];
  if (director.lens) parts.push(`lens ${director.lens}`);
  if (director.cameraMovement) parts.push(`camera movement ${director.cameraMovement}`);
  if (director.framing) parts.push(`framing ${director.framing}`);
  if (director.lightingMood) parts.push(`lighting mood ${director.lightingMood}`);
  if (director.performanceIntensity) parts.push(`performance intensity ${director.performanceIntensity}`);
  if (typeof director.durationSeconds === "number") parts.push(`duration ${director.durationSeconds}s`);
  return parts.length ? `Director: ${parts.join(", ")}` : undefined;
}

export const seedanceTarget: PromptTarget = {
  name: "seedance",
  render(ctx) {
    const lines: string[] = [];
    if (ctx.prefix) lines.push(ctx.prefix);
    lines.push(ctx.shot.action);
    const traits = lockedTraitsFor(ctx);
    if (traits.length) lines.push(`Character traits: ${traits.join(", ")}`);
    const directorLine = directorInstructions(ctx.shot.director);
    if (directorLine) lines.push(directorLine);
    const refs = referenceUrisFor(ctx);
    if (refs.length) lines.push(`References: ${refs.join(", ")}`);
    return lines.join("\n");
  },
};

export const higgsfieldTarget: PromptTarget = {
  name: "higgsfield",
  render(ctx) {
    const segments: string[] = [];
    if (ctx.prefix) segments.push(ctx.prefix);
    segments.push(ctx.shot.action);
    const traits = lockedTraitsFor(ctx);
    if (traits.length) segments.push(`traits(${traits.join("; ")})`);
    const directorLine = directorInstructions(ctx.shot.director);
    if (directorLine) segments.push(directorLine);
    const refs = referenceUrisFor(ctx);
    if (refs.length) segments.push(`refs[${refs.join(",")}]`);
    return segments.join(" | ");
  },
};

export const promptTargets: PromptTarget[] = [seedanceTarget, higgsfieldTarget];

export function emitPrompts(
  ctx: PromptContext,
  targets: PromptTarget[] = promptTargets,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const target of targets) out[target.name] = target.render(ctx);
  return out;
}
