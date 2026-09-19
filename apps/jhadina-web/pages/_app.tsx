import type { AppProps } from "next";
import "../src/styles/jhadina-tokens.css";
import { JhadinaShellNavigation } from "../src/components/JhadinaShellNavigation";
import { MiniPlayer } from "../src/components/jhadinaTv/MiniPlayer";

/** Shared chrome for the Pages Router tree. Keep this aligned with src/app/layout.tsx. */
export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <MiniPlayer />
      <JhadinaShellNavigation />
    </>
  );
}
