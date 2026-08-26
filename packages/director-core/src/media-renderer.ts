import type { EditableTimeline } from './timeline-model.js';

export type RenderRequest = {
  timeline: EditableTimeline;
  outputPath: string;
  videoCodec?: string;
  audioCodec?: string;
  container?: string;
};

export type RenderResult = {
  rendererId: string;
  outputPath: string;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
};

export interface MediaRenderer {
  readonly id: string;
  render(request: RenderRequest): Promise<RenderResult>;
}

export class MediaRendererRegistry {
  private readonly renderers = new Map<string, MediaRenderer>();

  register(renderer: MediaRenderer): void {
    if (this.renderers.has(renderer.id)) throw new Error(`Media renderer already registered: ${renderer.id}`);
    this.renderers.set(renderer.id, renderer);
  }

  get(rendererId: string): MediaRenderer {
    const renderer = this.renderers.get(rendererId);
    if (!renderer) throw new Error(`Unknown media renderer: ${rendererId}`);
    return renderer;
  }

  list(): string[] {
    return [...this.renderers.keys()];
  }
}
