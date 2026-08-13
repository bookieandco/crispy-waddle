import type { AppProps } from "next";
import { JhadinaShellNavigation } from "../src/components/JhadinaShellNavigation";
import { MiniPlayer } from "../src/components/jhadinaTv/MiniPlayer";

/**
 * Pages Router equivalent of src/app/layout.tsx's chrome. Next.js runs
 * the App Router and Pages Router as separate trees with separate root
 * shells, so the shell nav + mini player have to be mounted in both
 * places to actually be "persistent" across every route today (`/`,
 * `/jhadinatv`, `/jhadinatv/watch/[kind]/[id]` are Pages Router; the
 * rest are App Router). Neither wrapper touches what any individual
 * page renders.
 */
export default function App({ Component, pageProps }: AppProps) {
  return (
    <div style={{ paddingBottom: 76 }}>
      <Component {...pageProps} />
      <MiniPlayer />
      <JhadinaShellNavigation />
    </div>
  );
}
