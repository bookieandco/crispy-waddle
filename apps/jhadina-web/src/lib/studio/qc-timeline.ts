export type QCSeverity = "info" | "warning" | "critical";
export type QCLayer = "lip-sync" | "face" | "rig" | "tracking" | "camera" | "lighting" | "depth" | "color" | "motion" | "audio" | "render";

export interface QCMarker { id: string; layer: QCLayer; severity: QCSeverity; startFrame: number; endFrame: number; title: string; diagnosis: string; fixable: boolean; approved: boolean; }
export interface TimelineTrack { id: string; name: string; kind: "video" | "audio" | "rig" | "effect" | "qc"; muted: boolean; locked: boolean; }
export interface SceneEditorState { id: string; fps: number; durationFrames: number; currentFrame: number; tracks: TimelineTrack[]; markers: QCMarker[]; selectedMarkerId?: string; }

export function createSceneEditorState(id: string, fps = 24, durationFrames = 240): SceneEditorState {
  return { id, fps, durationFrames, currentFrame: 0, tracks: [], markers: [] };
}

export function addQCMarker(state: SceneEditorState, marker: Omit<QCMarker, "id" | "approved">): SceneEditorState {
  return { ...state, markers: [...state.markers, { ...marker, id: crypto.randomUUID(), approved: false }] };
}

export function approveQCMarker(state: SceneEditorState, markerId: string): SceneEditorState {
  return { ...state, markers: state.markers.map((marker) => marker.id === markerId ? { ...marker, approved: true } : marker) };
}

export function jumpToMarker(state: SceneEditorState, markerId: string): SceneEditorState {
  const marker = state.markers.find((item) => item.id === markerId);
  return marker ? { ...state, currentFrame: marker.startFrame, selectedMarkerId: markerId } : state;
}
