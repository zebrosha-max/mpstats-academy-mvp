import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://platform.mpstats.academy';
  const now = new Date();

  return [
    { url: baseUrl,                                lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${baseUrl}/pricing`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/skill-test`,                lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/courses`,                   lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${baseUrl}/courses/analytics`,         lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/courses/ads`,               lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/courses/ai`,                lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/courses/ozon`,              lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/about`,                     lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/roadmap`,                   lastModified: now, changeFrequency: 'weekly',  priority: 0.5 },
    { url: `${baseUrl}/login`,                     lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/register`,                  lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ];
}
