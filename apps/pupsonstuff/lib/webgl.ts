// lib/webgl.ts
//
// Real feature detection, not a try/catch around the whole 3D boutique.
// Creates an actual throwaway canvas and asks for a WebGl context — the
// same check browsers themselves recommend — rather than assuming support
// and finding out from a crashed <Canvas>.

export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}
