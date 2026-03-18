import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing', '/login', '/register'],
        disallow: ['/dashboard', '/learn', '/diagnostic', '/profile', '/admin', '/api'],
      },
    ],
    sitemap: 'https://platform.mpstats.academy/sitemap.xml',
  };
}
