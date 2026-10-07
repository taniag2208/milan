import type { NextConfig } from 'next'

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: supabaseHost ? [{ protocol: 'https', hostname: supabaseHost }] : [],
  },
  experimental: {
    serverActions: { bodySizeLimit: '6mb' },
  },
}

export default nextConfig
