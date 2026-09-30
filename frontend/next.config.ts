import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // Linting is run explicitly via `npm run lint`; don't block `next build`
    // on it in this PoC so `npm run build` verifies compilation independently.
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
