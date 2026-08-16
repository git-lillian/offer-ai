import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@offer-ai/ai",
    "@offer-ai/contracts",
    "@offer-ai/database",
    "@offer-ai/domain",
    "@offer-ai/ui",
  ],
};

export default nextConfig;
