import type { MetadataRoute } from "next";
import { BRAND_DESCRIPTION, BRAND_SHORT, BRAND_TITLE } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_TITLE,
    short_name: BRAND_SHORT,
    description: BRAND_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07070b",
    theme_color: "#0b0b0f",
    categories: ["books", "social", "education", "lifestyle"],
    icons: [
      {
        src: "/brand/tgc-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Gists",
        short_name: "Gists",
        description: "Swipe through books picked for you",
        url: "/",
      },
      {
        name: "Explore books",
        short_name: "Explore",
        description: "Discover new reads on TGC",
        url: "/explore",
      },
    ],
  };
}
