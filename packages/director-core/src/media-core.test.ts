import { describe, expect, it } from 'vitest';
import { addAudioTrack, addVideoTrack, createMediaProject, linkMediaClips, unlinkMediaClip, type MediaTrack } from './media-core';

const videoTrack: MediaTrack = { id: 'v1', name: 'V1', role: 'video', index: 0, clips: [{ id: 'vc1', assetId: 'video-1', trackId: 'v1', startSeconds: 0, durationSeconds: 10 }] };
const audioTrack: MediaTrack = { id: 'a1', name: 'A1', role: 'audio', index: 0, clips: [{ id: 'ac1', assetId: 'audio-1', trackId: 'a1', startSeconds: 0, durationSeconds: 10 }] };

function project() {
  return createMediaProject({ id: 'p1', name: 'Test', fps: 30, width: 1920, height: 1080, durationSeconds: 10 });
}

describe('media core', () => {
  it('keeps video and audio on separate track collections', () => {
    const result = addAudioTrack(addVideoTrack(project(), videoTrack), audioTrack);
    expect(result.videoTracks.map(t => t.role)).toEqual(['video']);
    expect(result.audioTracks.map(t => t.role)).toEqual(['audio']);
  });

  it('links clips across video and audio tracks without merging them', () => {
    const result = linkMediaClips(addAudioTrack(addVideoTrack(project(), videoTrack), audioTrack), 'vc1', 'ac1');
    expect(result.videoTracks[0].clips[0].linkedClipId).toBe('ac1');
    expect(result.audioTracks[0].clips[0].linkedClipId).toBe('vc1');
    expect(result.videoTracks).toHaveLength(1);
    expect(result.audioTracks).toHaveLength(1);
  });

  it('can unlink either side independently from the shared project', () => {
    const linked = linkMediaClips(addAudioTrack(addVideoTrack(project(), videoTrack), audioTrack), 'vc1', 'ac1');
    const result = unlinkMediaClip(linked, 'ac1');
    expect(result.videoTracks[0].clips[0].linkedClipId).toBe('ac1');
    expect(result.audioTracks[0].clips[0].linkedClipId).toBeUndefined();
  });
});
