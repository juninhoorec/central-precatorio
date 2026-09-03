import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/workspace", "/conta", "/api/"] },
    sitemap: "https://centralprecatorios.com.br/sitemap.xml",
  };
}
