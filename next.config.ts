import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Listing photos are pre-sized WebP on Supabase's CDN; skip Vercel's optimization quota.
  images: { unoptimized: true },
};

export default nextConfig;
