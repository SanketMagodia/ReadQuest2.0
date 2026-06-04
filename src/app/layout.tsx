import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Fraunces, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

// UI / body — a warm, modern humanist sans. Fed into the existing
// `--font-geist-sans` variable so every existing reference picks it up.
const sans = Plus_Jakarta_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Editorial display serif for top-level titles — gives the books brand a more
// characterful, "literary" feel that the geometric sans alone can't.
const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase:
    typeof process.env.NEXTAUTH_URL === "string"
      ? new URL(process.env.NEXTAUTH_URL)
      : new URL(`http://localhost:${process.env.PORT ?? 3000}`),
  applicationName: "Readquest",
  title: {
    default: "Readquest — Books, quotes, threads",
    template: "%s · Readquest",
  },
  description:
    "A reader-first social space: quotes, threaded discussions, and book discovery powered by community.",
  appleWebApp: {
    capable: true,
    title: "Readquest",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#07070b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} ${geistMono.variable}`}
    >
      <body className="bg-background text-foreground min-h-dvh antialiased">
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
