import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [{ source: "/admin", destination: "/management", permanent: false }];
  },
};

export default withSerwist(nextConfig);