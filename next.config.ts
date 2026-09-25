import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root: projectRoot },
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": [
      "./datasets/*.csv",
      "./datasets/India_Land_Cover/**/worldcover.tif",
    ],
  },
  outputFileTracingExcludes: {
    "/*": [
      "./src/**",
      "./docs/**",
      "./db/**",
      "./.env*",
      "./README.md",
      "./package-lock.json",
      "./bun.lock",
      "./datasets/India_Land_Cover/**/landsat.tif",
      "./datasets/India_Land_Cover/**/sentinel.tif",
    ],
  },
  serverExternalPackages: ["sharp"],
  reactStrictMode: false,
};

export default nextConfig;
