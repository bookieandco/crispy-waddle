import type { ClipRef, LocalizationTrack } from "./assembly.js";
import type { PromptContext } from "./emit.js";

export interface GenerationAdapter { name: string; generateClip(ctx: PromptContext, renderedPrompt: string): Promise<ClipRef>; }
export interface LocalizationAdapter { name: string; localize(clip: ClipRef, language: string): Promise<LocalizationTrack>; }
export interface AvatarPerformanceAdapter { name: string; performLine(entityId: string, dialogue: string, audioUri: string): Promise<ClipRef>; }
export interface ComicPanelAdapter { name: string; renderPanel(ctx: PromptContext, renderedPrompt: string): Promise<{ shotId: string; imageUri: string }>; }
export interface TouchUpAdapter { name: string; touchUp(clip: ClipRef, regionHint: string, instruction: string): Promise<ClipRef>; }
