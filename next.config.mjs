import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {(phase: string) => import('next').NextConfig} */
const createNextConfig = (phase) => {
  const useDefaultDistDir =
    phase === PHASE_DEVELOPMENT_SERVER ||
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.CI);

  return {
    output: "standalone",
    // Hosted builds expect Next's default .next output directory.
    distDir: useDefaultDistDir ? ".next" : ".next-build",
    experimental: {
      serverActions: {
        bodySizeLimit: "2mb",
      },
    },
    images: {
      remotePatterns: [
        {
          protocol: "https",
          hostname: "api.dicebear.com",
        },
      ],
    },
  };
};

export default createNextConfig;