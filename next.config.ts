import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable strict mode for better debugging and catching issues early
  reactStrictMode: true,

  // Use webpack for builds (Turbopack has font fetching issues)
  experimental: {
    useBuildModeWebpack: true,
  },
};

export default nextConfig;
