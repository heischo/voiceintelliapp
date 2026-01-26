/** @type {import('next').NextConfig} */
const nextConfig = {
  // CRITICAL: Tauri requires static export - SSR is NOT supported
  output: 'export',
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
