"use client";

// React error boundaries have to be class components — there's no hook
// equivalent. This exists specifically so a GLTF parse failure, a lost
// WebGL context, or any other runtime error inside the 3D boutique scene
// degrades to the existing flat-photo experience instead of taking the
// whole page down. Suspense (used inside BoutiqueScene) handles the
// *loading* state; this handles actual failures — two different things,
// both needed.

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
}

export default class BoutiqueSceneErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("3D boutique scene failed, falling back to flat photo:", error);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
