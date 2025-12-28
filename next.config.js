/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_REGISTRY_HOST: process.env.REGISTRY_HOST,
  },
};

module.exports = nextConfig;