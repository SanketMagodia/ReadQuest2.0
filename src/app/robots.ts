import type { MetadataRoute } from "next";

function siteUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/admin/",
          "/admin",
          "/compose",
          "/offline",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
