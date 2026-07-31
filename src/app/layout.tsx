import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LastMilePrep — SSC CGL Practice Platform",
  description:
    "Practice SSC CGL previous year papers with 10,614 verified questions, authentic CBT interface, and AI-powered analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-gray-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
