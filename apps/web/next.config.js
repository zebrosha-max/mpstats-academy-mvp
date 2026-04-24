const path = require('path');
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  reactStrictMode: true,
  // Explicit env block forces Next.js to inline these at build time regardless
  // of turbo v2 strict mode / pnpm env filtering. Read from process.env at
  // config load time, which is before any tool can strip them.
  env: {
    NEXT_PUBLIC_STAGING: process.env.NEXT_PUBLIC_STAGING || '',
    NEXT_PUBLIC_SHOW_LIBRARY: process.env.NEXT_PUBLIC_SHOW_LIBRARY || '',
  },
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
