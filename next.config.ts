import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // This project is nested in a wider development workspace with other lockfiles.
    root: __dirname,
  },
};

export default nextConfig;
