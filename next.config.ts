import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable strict mode for better debugging and catching issues early
  reactStrictMode: true,

  // Empty turbopack config to silence warning when using default Turbopack
  turbopack: {},
};

export default nextConfig;
