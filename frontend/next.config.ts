import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const backend = (process.env.LMS_API_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);

const nextConfig = (phase: string): NextConfig => ({
  experimental: {
    agentFeedback: true,
    workerThreads: phase === PHASE_DEVELOPMENT_SERVER && process.platform === "win32",
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: process.cwd(),
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/v1/:path*` }];
  },
  async redirects() {
    return [
      {
        source: "/courses/programming",
        destination: "/courses?topic=programming",
        permanent: false,
      },
      {
        source: "/courses/design",
        destination: "/courses?topic=design",
        permanent: false,
      },
      { source: "/faq", destination: "/pages#faq", permanent: false },
      { source: "/blog", destination: "/pages#bai-viet", permanent: false },
    ];
  },
});

export default nextConfig;
