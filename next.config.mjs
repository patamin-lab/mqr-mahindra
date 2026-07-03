/** @type {import('next').NextConfig} */
const nextConfig = {
eslint: { ignoreDuringBuilds: true },
experimental: {
  outputFileTracingIncludes: {
    // Same reasoning as public/fonts/** below: Next does not bundle
    // public/ into a serverless function's file trace by default, but
    // PdfBrandLogo.tsx reads the logo from disk (fs.existsSync +
    // <Image src={path}>), not over HTTP - it must be explicitly included
    // or the logo would silently never render in production even once the
    // asset file exists.
    '/**': ['./public/fonts/**', './public/assets/**'],
  },
},
};
export default nextConfig;
