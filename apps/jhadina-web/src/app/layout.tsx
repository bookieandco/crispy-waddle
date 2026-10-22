import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JhadinaShellNavigation } from "../components/JhadinaShellNavigation";
import { MiniPlayer } from "../components/jhadinaTv/MiniPlayer";
import { PersistentMusicPlayer } from "../components/music/PersistentMusicPlayer";
import { LocalMusicPlayer } from "../components/music/LocalMusicPlayer";
import "../styles/jhadina-experience.css";

export const metadata: Metadata = {
  title: "Jhadina",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <MiniPlayer />
        <PersistentMusicPlayer />
        <LocalMusicPlayer />
        <JhadinaShellNavigation />
      </body>
    </html>
  );
}
