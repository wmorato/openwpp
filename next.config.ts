import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@chenglou/pretext'],
  turbopack: {},
  serverExternalPackages: ['whatsapp-web.js'],
};

export default nextConfig;
