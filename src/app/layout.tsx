import type { Metadata, Viewport } from "next";
import { RegisterSW } from "@/components/register-sw";
import "./globals.css";

const SITE_URL = "https://pressipro.tech";

export const metadata: Metadata = {
  title: {
    default: "PressiPro — Logiciel de Gestion de Pressing au Sénégal",
    template: "%s | PressiPro",
  },
  description:
    "PressiPro est le logiciel SaaS #1 de gestion de pressing au Sénégal. Commandes, paiements Wave/OM, reçus PDF, dashboard temps réel. Essai gratuit.",
  keywords: [
    "gestion pressing",
    "logiciel pressing",
    "pressing Sénégal",
    "pressing Dakar",
    "pressing Rufisque",
    "logiciel blanchisserie",
    "SaaS pressing",
    "gestion laverie",
    "reçu pressing",
    "PressiPro",
    "logiciel gestion pressing Dakar",
    "application pressing Sénégal",
    "gestion commande pressing",
    "paiement Wave pressing",
    "paiement Orange Money pressing",
  ],
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fr_SN",
    url: SITE_URL,
    siteName: "PressiPro",
    title: "PressiPro — Logiciel de Gestion de Pressing au Sénégal",
    description:
      "Digitalisez votre pressing en 30 secondes. Commandes, paiements, reçus PDF, statistiques — tout sur votre téléphone. Essai gratuit, sans carte bancaire.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PressiPro — Gestion de Pressing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PressiPro — Logiciel de Gestion de Pressing au Sénégal",
    description:
      "Digitalisez votre pressing en 30 secondes. Commandes, paiements, reçus PDF, statistiques. Essai gratuit.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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
  verification: {
    google: "googleecd6b880cc8a2124",
  },
  category: "business",
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "PressiPro",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description:
      "Logiciel SaaS de gestion de pressing au Sénégal. Commandes, paiements Wave/OM, reçus PDF, dashboard.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "XOF",
      description: "Essai gratuit 14 jours",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "50",
      bestRating: "5",
    },
    author: {
      "@type": "Person",
      name: "Alioune Ndiaye",
    },
  };

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PressiPro",
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+221786037913",
      contactType: "customer service",
      availableLanguage: ["French"],
      areaServed: "SN",
    },
    sameAs: [],
  };

  return (
    <html lang="fr">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </head>
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
