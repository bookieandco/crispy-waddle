import type { MediaAsset, ProxyJob, ProxyProfile } from './media-core';

export type MediaProcessRequest = {
  requestId: string;
  projectId: string;
  inputUri: string;
  outputUri: string;
  args: string[];
};

export type MediaProcessResult = {
  requestId: string;
  status: 'completed' | 'failed';
  outputUri?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export interface MediaProcessor {
  readonly id: string;
  process(request: MediaProcessRequest): Promise<MediaProcessResult>;
}

export type ProxyProvider = {
  readonly id: string;
  createProxy(input: { job: ProxyJob; asset: MediaAsset }): Promise<ProxyJob>;
};

export function proxyProfileArguments(profile: ProxyProfile): string[] {
  switch (profile) {
    case 'preview-540p': return ['-vf', 'scale=-2:540', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-c:a', 'aac', '-b:a', '96k'];
    case 'preview-720p': return ['-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-c:a', 'aac', '-b:a', '128k'];
    case 'edit-1080p': return ['-vf', 'scale=-2:1080', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '160k'];
  }
}
