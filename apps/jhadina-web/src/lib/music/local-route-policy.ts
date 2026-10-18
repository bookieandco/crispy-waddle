/** During SWLC outage the private Vercel preview may serve only client-local files.
 * This is NOT a production auth bypass and does not cover any API endpoint. */
export function isLocalMusicPreviewRoute(pathname: string, vercelEnv: string | undefined): boolean {
  return pathname === "/music/local" && vercelEnv === "preview";
}
