import type { NextConfig } from "next";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** LAN IPv4s plus loopback, so HMR works from localhost *and* the Network URL. */
function devOrigins() {
  const hosts = new Set(["localhost", "127.0.0.1"]);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) hosts.add(a.address);
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  // Multiple lockfiles exist above this project (e.g. D:\project\yarn.lock),
  // so Next/Turbopack mis-infers the workspace root and fails to register the
  // App Router routes. Pin the root to this project directory.
  turbopack: {
    root: projectRoot,
  },
  allowedDevOrigins: devOrigins(),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  async redirects() {
    return [];
  },
};

export default nextConfig;
