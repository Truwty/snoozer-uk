/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "128kb" } },
};

export default config;
