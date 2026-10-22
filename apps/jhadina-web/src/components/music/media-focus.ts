export type JhadinaMediaDomain = "music" | "tv" | "local" | "youtube";
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
    if ((other === "music" || other === "tv" || other === "local" || other === "youtube") && other !== domain) pause();
  };
  window.addEventListener(JHADINA_MEDIA_FOCUS_EVENT, listener);
  return () => window.removeEventListener(JHADINA_MEDIA_FOCUS_EVENT, listener);
}

/** One visible YouTube iframe across the Rare Finds and Discovery panels. */
export const JHADINA_YOUTUBE_PLAYER_EVENT="jhadina:youtube-visible-player";
export type JhadinaYouTubePanel="discovery"|"rare";
export function announceJhadinaYouTubePlayer(source:JhadinaYouTubePanel){
  if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent<{source:JhadinaYouTubePanel}>(
    JHADINA_YOUTUBE_PLAYER_EVENT,{detail:{source}}));
}
export function listenForOtherYouTubePlayer(source:JhadinaYouTubePanel,stop:()=>void){
  if(typeof window==="undefined")return()=>{};
  const listener=(event:Event)=>{
    const other=(event as CustomEvent<{source?:string}>).detail?.source;
    if((other==="discovery"||other==="rare")&&other!==source)stop();
  };
  window.addEventListener(JHADINA_YOUTUBE_PLAYER_EVENT,listener);
  return()=>window.removeEventListener(JHADINA_YOUTUBE_PLAYER_EVENT,listener);
}
