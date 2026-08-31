/** @type {import('next').NextConfig} */
const backendTarget =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://199.192.23.46:4702';

const nextConfig = {
  reactStrictMode: true,
  // `standalone` output is only for the self-hosted Docker image. On Vercel,
  // let the platform handle output/tracing — forcing standalone there can break
  // the build. `VERCEL` is set automatically in Vercel's build environment.
  output: process.env.VERCEL ? undefined : 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendTarget.replace(/\/+$/, '')}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
