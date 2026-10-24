/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The landing page used to live at /library.
  async redirects() {
    return [{ source: "/library", destination: "/", permanent: true }]
  },
}
export default nextConfig
