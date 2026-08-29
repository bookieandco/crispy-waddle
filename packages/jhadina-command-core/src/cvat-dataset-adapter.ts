import type { VisualDatasetPort, VisualSample } from "./visual-dataset-port";

export interface CvatDatasetClient {
  createTask(input: {
    name: string;
    image: string;
    mediaType: string;
    source: "screen" | "camera";
    metadata?: Record<string, string>;
  }): Promise<{ taskId: string }>;
}

/** Thin adapter: CVAT is a learning/annotation sink, never part of the live vision path. */
export class CvatVisualDatasetAdapter implements VisualDatasetPort {
  constructor(private readonly client: CvatDatasetClient) {}

  async submit(sample: VisualSample): Promise<{ sampleId: string }> {
    const task = await this.client.createTask({
      name: `jhadina-${sample.source}-${sample.id}`,
      image: sample.image,
      mediaType: sample.mediaType,
      source: sample.source,
      metadata: sample.metadata,
    });

    return { sampleId: task.taskId };
  }
}
