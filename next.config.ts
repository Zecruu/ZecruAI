import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["child_process", "ts-node"],
  turbopack: {},
};

export default nextConfig;
