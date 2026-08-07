import type { NextConfig } from "next";

// The API is deployed as its own service, but the browser has to see it on the
// app's own origin. The auth cookies the backend sets (`access_token`,
// `refresh_token`, `session_role`) are host-scoped, so when the API answers from
// a different host the browser files them under *that* host and never sends them
// back here — leaving proxy.ts unable to read `session_role` and bouncing every
// dashboard route to /login. Widening the cookie with a Domain attribute is not
// an option either: `vercel.app` is on the Public Suffix List, so no cookie may
// be scoped to it. Proxying /api through Next makes the cookies first-party,
// which also keeps SameSite=lax working instead of forcing SameSite=None.
//
// Trailing slash is stripped so `https://api.example.com/` and
// `https://api.example.com` both produce a valid destination.
const backendOrigin = (process.env.BACKEND_ORIGIN ?? "http://localhost:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
