export type JhadinaMediaDomain = "music" | "tv";
export const JHADINA_MEDIA_FOCUS_EVENT = "jhadina:media-focus";
/** Coordinate only user-initiated audible output in one browser document.
 * Cross-device and legacy full-page navigations require a separate native/session arbiter.
 */
export function acquireJhadinaMediaFocus(domain: JhadinaMediaDomain) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<{ domain: JhadinaMediaDomain }>(JHADINA_MEDIA_FOCUS_EVENT, { detail: { domain } }));
  }
}
export function listenForOtherMediaFocus(domain: JhadinaMediaDomain, pause: () => void) {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const other = (event as CustomEvent<{ domain?: string }>).detail?.domain;
    if ((other === "music" || other === "tv") && other !== domain) pause();
  };
  window.addEventListener(JHADINA_MEDIA_FOCUS_EVENT, listener);
  return () => window.removeEventListener(JHADINA_MEDIA_FOCUS_EVENT, listener);
}
