/**
 * Adapter contracts for pipeline stages this package cannot run itself.
 *
 * None of these are implemented here — no HTTP calls, no subprocess
 * spawning, no GPU. Each interface documents the input/output shape a
 * real integration would need to satisfy, and which reviewed repo it
 * corresponds to. This is the same boundary the package README already
 * draws for image/video generation (no ComfyUI, no GPU-backed serving);
 * these four stages are additional instances of the same boundary, not
 * an exception to it.
 *
 * Deliberately not wired to any of these repos directly:
 * - Wan2.2, VideoLingo, OpenMontage, ArcReel, waoowaoo, Toonflow-app are
 *   full Python/full-stack applications (FastAPI, Streamlit, Next.js) —
 *   wrong stack to vendor into a TypeScript package, and OpenMontage is
 *   AGPL-3.0, which rules out vendoring its code regardless of stack.
 * - ArcReel, OpenMontage, Toonflow-app, and waoowaoo are four competing
 *   full implementations of the same "novel/script -> consistent
 *   characters -> storyboard -> video" orchestrator. They're evidence
 *   this package's Shot/Entity.lockedTraits/ReferenceAsset shape is the
 *   right one (all four converge on it independently) — they are not
 *   four things to integrate in parallel. Picking one as an actual
 *   orchestrator UI, if wanted, is a separate decision, not made here.
 */
import type { ClipRef, LocalizationTrack } from "./assembly.js";
import type { PromptContext } from "./emit.js";

/** Generates one clip for a shot's rendered prompt. Modeled on what
 * Seedance 2.0/Higgsfield already target via `emit.ts`, or a
 * self-hosted Wan-Video/Wan2.2 instance (GPU required, ~5s/720p clips —
 * why `assembly.ts` exists: this adapter is expected to produce short
 * clips, not long-form video). */
export interface GenerationAdapter {
  name: string;
  generateClip(ctx: PromptContext, renderedPrompt: string): Promise<ClipRef>;
}

/** Subtitles + dubbed audio for one shot's clip, in one language.
 * Modeled on Huanshere/VideoLingo's actual output shape. */
export interface LocalizationAdapter {
  name: string;
  localize(clip: ClipRef, language: string): Promise<LocalizationTrack>;
}

/** Alternative to clip generation for talking-head / avatar-driven
 * segments: a live or pre-rendered VRM avatar performance instead of a
 * diffusion-generated clip. Not duration-capped the way generation
 * adapters are, since it's driven by TTS + pose data rather than
 * per-clip diffusion — a second route to "longer" content for segments
 * that are dialogue-driven rather than cinematic. Modeled conceptually
 * on dexvdev/svelte-vrm-live (Svelte + Three.js VRM renderer); not
 * fetched in detail this round, flagged here rather than guessed at. */
export interface AvatarPerformanceAdapter {
  name: string;
  performLine(entityId: string, dialogue: string, audioUri: string): Promise<ClipRef>;
}

/** Comic-panel still sequence as an alternative output branch to
 * full video generation for a shot — cheaper, and sidesteps clip-length
 * limits entirely since panels don't need to be stitched by duration.
 * Modeled conceptually on LingyiChen-AI/AIComicBuilder; not fetched in
 * detail this round, flagged here rather than guessed at. */
export interface ComicPanelAdapter {
  name: string;
  renderPanel(ctx: PromptContext, renderedPrompt: string): Promise<{ shotId: string; imageUri: string }>;
}
