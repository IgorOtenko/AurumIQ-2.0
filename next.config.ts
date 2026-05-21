import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent bcryptjs from being bundled in edge runtime
  serverExternalPackages: ["bcryptjs"],
};

export default nextConfig;
