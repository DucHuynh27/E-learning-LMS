import type { NextConfig } from "next";

const backend = (process.env.LMS_API_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/v1/:path*` }];
  },
};

export default nextConfig;
