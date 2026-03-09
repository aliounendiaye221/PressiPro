import type { Metadata, Viewport } from "next";
import { RegisterSW } from "@/components/register-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: "PressiPro - Gestion de Pressing",
  description: "SaaS de gestion de pressing pour Rufisque/Dakar",
  manifest: "/manifest.json",
  applicationName: "PressiPro",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PressiPro",
  },
  icons: {
    apple: "/icon-192.png",
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
