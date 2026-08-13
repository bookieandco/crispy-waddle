import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JhadinaShellNavigation } from "../components/JhadinaShellNavigation";
import { MiniPlayer } from "../components/jhadinaTv/MiniPlayer";

export const metadata: Metadata = {
  title: "Jhadina",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, paddingBottom: 76 }}>
        {children}
        <MiniPlayer />
        <JhadinaShellNavigation />
      </body>
    </html>
  );
}
