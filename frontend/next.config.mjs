/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['v1ln.l.dedikuoti.lt'],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
