const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  reactStrictMode: true,
  eslint: {
    // ESLint runs in CI; skip during Docker build to avoid plugin version mismatches
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['@mpstats/api', '@mpstats/db', '@mpstats/shared'],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'kinescope.io',
      },
    ],
  },
};

module.exports = nextConfig;
