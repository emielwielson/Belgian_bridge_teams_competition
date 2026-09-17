import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/arbiter/honor/bridgemate/bws": [
      "./fixtures/bridgemate/Template_Access2000_v5.bws",
    ],
  },
};

export default withNextIntl(nextConfig);
