"use client";

// React error boundaries have to be class components — there's no hook
// equivalent. Originally built just for the 3D boutique room
// (BoutiqueSceneErrorBoundary); generalized here after the exact failure
// mode it exists for showed up in Product3DEngine too — drei's
// <Environment preset="..."> fetches an HDR file from an external CDN,
// and an app-crashing uncaught error is exactly what happened the first
// time a product's "View in 3D" was actually driven end-to-end in a
// browser with that fetch blocked ("Application error: a client-side
// exception has occurred", the whole page down, not just the product
// preview). Suspense (used inside both scenes) handles the *loading*
// state; this handles actual failures — two different things, both
// needed, and every real-time-3D surface in this app should have one.

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
}

export default class Scene3DErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("3D scene failed, falling back:", error);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
