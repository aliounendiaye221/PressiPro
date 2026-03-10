import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/orders/", "/customers/", "/settings/", "/admin/"],
      },
    ],
    sitemap: "https://pressipro.tech/sitemap.xml",
  };
}
