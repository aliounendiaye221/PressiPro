import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://pressipro.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms"],
        disallow: [
          "/api/",
          "/dashboard/",
          "/orders/",
          "/customers/",
          "/caisse/",
          "/expenses/",
          "/subscription/",
          "/settings/",
          "/admin/",
          "/share/",
          "/checkout/",
          "/offline",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
