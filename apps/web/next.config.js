const path = require('path');
const { withSentryConfig } = require('@sentry/nextjs');

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

module.exports = withSentryConfig(nextConfig, {
  // Upload source maps for readable stack traces
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Auth token for source map uploads
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Hide source maps from client bundles in production
  hideSourceMaps: true,
  // Silence source map upload logs unless there's an error
  silent: !process.env.CI,
});
