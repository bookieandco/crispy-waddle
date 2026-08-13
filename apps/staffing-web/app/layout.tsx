import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "StaffingOS",
  description: "Digital staffing operations for workers, employers, and staffing agencies.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
