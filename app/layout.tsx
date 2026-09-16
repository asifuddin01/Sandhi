import type { Metadata, Viewport } from "next";
import {
  Hanken_Grotesk,
  IBM_Plex_Mono,
  Spectral,
  Tiro_Devanagari_Sanskrit,
} from "next/font/google";
import type { ReactNode } from "react";

import { PageTransition } from "@/components/motion/PageTransition";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { siteIdentity } from "@/content/strings";
import { themeMetadataColors } from "@/styles/tokens";

import "./globals.css";

const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const devanagari = Tiro_Devanagari_Sanskrit({
  variable: "--font-tiro-devanagari",
  subsets: ["devanagari", "latin"],
  weight: "400",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteIdentity.url),
  applicationName: siteIdentity.name,
  title: {
    default: siteIdentity.name,
    template: `%s | ${siteIdentity.name}`,
  },
  description:
    "An independent research lab exploring artificial intelligence and computational science.",
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: themeMetadataColors.dark },
    {
      media: "(prefers-color-scheme: light)",
      color: themeMetadataColors.light,
    },
  ],
};

const preferenceScript = `(() => {
  try {
    const root = document.documentElement;
    const storedTheme = localStorage.getItem("sandhi-theme");
    const theme = storedTheme === "dark" || storedTheme === "light"
      ? storedTheme
      : matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    root.dataset.theme = theme;
    if (localStorage.getItem("sandhi-reduce-motion") === "true") {
      root.dataset.reduceMotion = "true";
    }
  } catch {}
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${spectral.variable} ${hanken.variable} ${devanagari.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main-content" tabIndex={-1}>
          <PageTransition>{children}</PageTransition>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
