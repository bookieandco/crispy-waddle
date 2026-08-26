import { describe, expect, it } from 'vitest';
import { proxyProfileArguments } from './media-processor';

describe('proxyProfileArguments', () => {
  it('provides CPU-friendly preview settings', () => {
    expect(proxyProfileArguments('preview-540p')).toContain('scale=-2:540');
    expect(proxyProfileArguments('preview-540p')).toContain('-preset');
    expect(proxyProfileArguments('preview-720p')).toContain('scale=-2:720');
  });

  it('provides an edit-quality 1080p profile', () => {
    const args = proxyProfileArguments('edit-1080p');
    expect(args).toEqual(['-vf', 'scale=-2:1080', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '160k']);
  });
});
