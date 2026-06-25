import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@chenglou/pretext'],
  turbopack: {},
  serverExternalPackages: ['whatsapp-web.js'],
  poweredByHeader: false,
  generateBuildId: () => 'hidden',
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.moratosolucoes.com.br wss:; font-src 'self' data:; frame-src 'none'; object-src 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
