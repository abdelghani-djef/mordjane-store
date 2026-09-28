import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // The dev server only trusts `localhost` by default; allow the loopback IP too so HMR and
  // dev chunks load when browsing http://127.0.0.1:3000 (e2e tests use it).
  allowedDevOrigins: ["127.0.0.1"],
  // Keep the dev-mode indicator clear of the admin sidebar footer.
  devIndicators: { position: "bottom-right" },
  // The browser only ever talks to Next; /api and /media are proxied to FastAPI so the
  // admin session cookie is first-party and no CORS is needed. (Proxy runs *before*
  // rewrites, so src/proxy.ts excludes these paths from locale handling.)
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/media/:path*", destination: `${backendUrl}/media/:path*` },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
export default withNextIntl(nextConfig);
