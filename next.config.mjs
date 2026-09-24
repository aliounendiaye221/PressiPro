import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  eslint: {
    // Évite les blocages de build CI/Vercel liés à ESLint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Les types restent validés strictement par `tsc --noEmit`
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            // Permissions-Policy: limiter l'accès aux APIs sensibles.
            // La caméra est autorisée pour le scanner QR.
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), payment=()",
          },
          {
            // Content-Security-Policy : réduit la surface d'attaque XSS.
            // - default-src 'self' : tout depuis le même domaine par défaut
            // - script-src 'self' 'unsafe-inline' : Next.js nécessite unsafe-inline pour les scripts inline
            // - style-src 'self' 'unsafe-inline' : Tailwind CSS requiert unsafe-inline
            // - img-src 'self' data: blob: https: : autorise les logos externes (base64/blob/https)
            // - font-src 'self' data: : polices locales + base64
            // - connect-src 'self' : API calls vers le même domaine uniquement
            // - frame-ancestors 'self' : équivalent X-Frame-Options SAMEORIGIN (plus précis)
            // - object-src 'none' : bloque Flash et plugins obsolètes
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "media-src 'self'",
              "frame-src 'none'",
              "frame-ancestors 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
