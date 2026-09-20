import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

/*
 * Code-generated Open Graph / share card (1200x630), no photography. Renders the
 * LastMilePrep mark, a headline (?title=), and the site's own palette. Used by
 * every page's metadata via /api/og?title=...
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title =
    (searchParams.get("title") || "Free timed SSC CGL section, real sectional locks").slice(0, 120);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0b0b0c",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* gradient wash */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "8px",
            background: "linear-gradient(90deg, #4f46e5, #7c3aed, #db2777)",
            display: "flex",
          }}
        />
        {/* brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "18px",
              background: "linear-gradient(135deg, #6366f1, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "38px",
              fontWeight: 800,
            }}
          >
            L
          </div>
          <div style={{ display: "flex", fontSize: "34px", fontWeight: 700, color: "white" }}>
            LastMile<span style={{ color: "#a5b4fc" }}>Prep</span>
          </div>
        </div>

        {/* headline */}
        <div
          style={{
            display: "flex",
            fontSize: "68px",
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: "white",
            maxWidth: "1000px",
          }}
        >
          {title}
        </div>

        {/* footer strip */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", color: "#a1a1aa", fontSize: "26px" }}>
          <span style={{ display: "flex", color: "#c4b5fd", fontWeight: 700 }}>MarksenseAI</span>
          <span style={{ display: "flex" }}>·</span>
          <span style={{ display: "flex" }}>Four 15-minute sectional locks</span>
          <span style={{ display: "flex" }}>·</span>
          <span style={{ display: "flex" }}>lastmileprep.in</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
