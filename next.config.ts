import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent bcryptjs from being bundled in edge runtime
  serverExternalPackages: ["bcryptjs"],
  // ESLint runs separately via `pnpm lint`; skip during build to avoid
  // config resolution issues in git worktree environments where the
  // parent directory's .eslintrc.json may be resolved first.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
