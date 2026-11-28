/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  async redirects() {
    return [
      { source: "/help", destination: "https://help.snoozer.uk/", permanent: true },
      { source: "/help/:path*", destination: "https://help.snoozer.uk/:path*", permanent: true },
      { source: "/status", destination: "https://status.snoozer.uk/", permanent: true },
      { source: "/status/:path*", destination: "https://status.snoozer.uk/:path*", permanent: true },
    ];
  },
};

export default config;
