/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `standalone` output is only for the self-hosted Docker image. On Vercel,
  // let the platform handle output/tracing — forcing standalone there can break
  // the build. `VERCEL` is set automatically in Vercel's build environment.
  output: process.env.VERCEL ? undefined : 'standalone',
};
export default nextConfig;
