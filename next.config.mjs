/** @type {import('next').NextConfig} */
const nextConfig = {
eslint: { ignoreDuringBuilds: true },
experimental: {
  outputFileTracingIncludes: {
    '/**': ['./public/fonts/**'],
  },
},
};
export default nextConfig;
