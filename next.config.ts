import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@chenglou/pretext'],
  webpack: (config) => {
    config.watchOptions = {
      ignored: ['**/.wwebjs_auth/**', '**/../.wwebjs_auth_openwpp/**', '**/node_modules/**']
    }
    return config;
  }
};

export default nextConfig;
