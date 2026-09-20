import type { Metadata } from "next";

const OG = "/api/og?title=" + encodeURIComponent("Free timed SSC CGL section, no sign-up");

export const metadata: Metadata = {
  title: "Free timed SSC CGL section",
  description:
    "One full timed section, 25 questions, 15 minutes, the real sectional lock. No sign-up, no card. See your net score and the structure of your MarksenseAI report.",
  alternates: { canonical: "/sample" },
  openGraph: {
    title: "Free timed SSC CGL section, real sectional locks",
    description:
      "25 questions, 15 minutes, the real sectional lock. No sign-up, no card. Then see what MarksenseAI would tell you.",
    url: "https://lastmileprep.in/sample",
    images: [{ url: OG, width: 1200, height: 630, alt: "Free SSC CGL section" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free timed SSC CGL section, real sectional locks",
    description:
      "25 questions, 15 minutes, the real sectional lock. No sign-up, no card.",
    images: [OG],
  },
};

export default function SampleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
