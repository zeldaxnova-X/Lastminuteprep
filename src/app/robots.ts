import type { MetadataRoute } from "next";

const SITE_URL = "https://lastmileprep.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // App-private surfaces stay out of the index; public marketing + legal
        // pages (landing, sample, marksenseai, /terms etc.) remain crawlable.
        disallow: ["/api/", "/dashboard", "/test/", "/marksense/", "/welcome", "/login"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
