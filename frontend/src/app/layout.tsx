import type { Metadata } from "next";
import { Source_Serif_4, Geist } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: "TrakPlus — track everything you watch, play, and read",
  description:
    "One self-hosted tracker for movies, TV, games, anime, and manga — with India-specific streaming info and episode-level progress.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sourceSerif.variable} ${geist.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
