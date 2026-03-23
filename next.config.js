/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow images from any domain for OG preview
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  // Increase serverless function timeout for analysis
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig
