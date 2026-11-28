/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  async redirects() {
    return [
      { source: "/status", destination: "https://status.snoozer.uk/", permanent: true },
      { source: "/status/:path*", destination: "https://status.snoozer.uk/:path*", permanent: true },
    ];
  },
};

export default config;
