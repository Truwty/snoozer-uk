/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "64kb" } },
};

export default config;
