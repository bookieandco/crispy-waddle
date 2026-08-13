export type PointerDrag = { clipId: string; mode: 'move' | 'trim-start' | 'trim-end'; startX: number; originalStart: number; originalDuration: number };

export function secondsFromPointer(clientX: number, timelineLeft: number, pixelsPerSecond: number) {
  return Math.max(0, (clientX - timelineLeft) / pixelsPerSecond);
}

export function applyPointerDrag(drag: PointerDrag, clientX: number, timelineLeft: number, pixelsPerSecond: number) {
  const delta = (clientX - drag.startX) / pixelsPerSecond;
  if (drag.mode === 'move') return { startSeconds: Math.max(0, drag.originalStart + delta) };
  if (drag.mode === 'trim-start') {
    const start = Math.max(0, Math.min(drag.originalStart + drag.originalDuration - 0.1, drag.originalStart + delta));
    return { startSeconds: start, durationSeconds: drag.originalDuration + drag.originalStart - start };
  }
  return { durationSeconds: Math.max(0.1, drag.originalDuration + delta) };
}
