import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://lastmileprep.in";
const OG_DEFAULT = "/api/og?title=" + encodeURIComponent("Free timed SSC CGL section, real sectional locks");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "LastMilePrep, SSC CGL Practice Platform",
    template: "%s · LastMilePrep",
  },
  description:
    "Practise SSC CGL Tier 1 on a faithful CBT interface with the real four 15-minute sectional locks, and MarksenseAI that shows you exactly how to score more marks.",
  applicationName: "LastMilePrep",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "LastMilePrep",
    url: SITE_URL,
    title: "LastMilePrep, SSC CGL Practice Platform",
    description:
      "A faithful SSC CGL Tier 1 CBT with the real four 15-minute sectional locks, plus MarksenseAI to turn your mock into more marks.",
    images: [{ url: OG_DEFAULT, width: 1200, height: 630, alt: "LastMilePrep" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LastMilePrep, SSC CGL Practice Platform",
    description:
      "A faithful SSC CGL Tier 1 CBT with the real four 15-minute sectional locks, plus MarksenseAI to turn your mock into more marks.",
    images: [OG_DEFAULT],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full bg-bg text-ink antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
