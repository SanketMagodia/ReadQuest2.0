import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Readquest — Books, quotes, threads",
    short_name: "Readquest",
    description:
      "A reader-first social space: quotes, threaded discussions, and book discovery powered by community.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07070b",
    theme_color: "#0b0b0f",
    categories: ["books", "social", "education", "lifestyle"],
    icons: [
      {
        src: "/logo192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Compose a quote",
        short_name: "Compose",
        description: "Share a line that moved you",
        url: "/compose",
      },
      {
        name: "Explore books",
        short_name: "Explore",
        description: "Discover new reads",
        url: "/explore",
      },
    ],
  };
}
