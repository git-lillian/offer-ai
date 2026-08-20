import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@offer-ai/admissions-engine",
    "@offer-ai/ai",
    "@offer-ai/billing",
    "@offer-ai/config",
    "@offer-ai/contracts",
    "@offer-ai/database",
    "@offer-ai/domain",
    "@offer-ai/notifications",
    "@offer-ai/ui",
  ],
};

export default nextConfig;
