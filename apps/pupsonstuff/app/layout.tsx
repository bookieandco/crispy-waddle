import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "PupsonStuff — Your Dog. Your Style. Forever.",
  description:
    "Luxury AI pet portraits on premium canvas, apparel, and drinkware. Shop the boutique.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} font-body`}>
        {/* App-wide, unlike MusicProvider (scoped inside Boutique.tsx,
            correctly page-mood-specific) — cart state has to survive a
            full navigation away to Stripe's hosted checkout and back to
            a *different* route (/checkout/success), so every route
            needs it, not just the storefront. It's backed by
            localStorage (see CartContext.tsx), so this remount on
            return is exactly what re-hydrates the same cart, not a
            reset of it. */}
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
