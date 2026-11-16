/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};

export default config;
