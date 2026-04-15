/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deshabilita el cache de webpack en disco en dev (evita warnings ENOENT en Windows)
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false
    }
    return config
  },
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
