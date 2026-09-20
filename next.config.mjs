import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The policy pages read src/content/policies/*.md at build time; keep the
  // files in the serverless bundle in case a route is ever rendered on demand.
  experimental: {
    outputFileTracingIncludes: {
      "/policies/[slug]": ["./src/content/policies/**/*"],
    },
  },
  async redirects() {
    return [
      { source: "/admin", destination: "/management", permanent: false },
      { source: "/terms", destination: "/policies/terms-of-service", permanent: true },
    ];
  },
};

export default withSerwist(nextConfig);