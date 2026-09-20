import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Consolidate link equity + trust on the apex domain. Once lastmileprep.in is
  // connected in Vercel, any request that still lands on the *.vercel.app host is
  // permanently redirected to the apex. Harmless before the apex is live (the
  // condition simply never matches for apex traffic).
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "lastmileprep.vercel.app" }],
        destination: "https://lastmileprep.in/:path*",
        permanent: true,
      },
    ];
  },
  // Production source maps are NOT emitted for the client (default), so engine
  // code / thresholds never ship in a .map. Kept explicit as a guardrail.
  productionBrowserSourceMaps: false,
};

export default nextConfig;
