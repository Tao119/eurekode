import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/help", "/terms", "/privacy"],
        disallow: [
          "/api/",
          "/dashboard",
          "/chat/",
          "/settings/",
          "/admin/",
          "/learnings",
          "/history",
          "/projects",
          "/unorganized",
          "/verify-email",
          "/reset-password",
          "/forgot-password",
          "/register/success",
          "/register/verify-pending",
          "/join",
        ],
      },
    ],
    sitemap: "https://www.eurecode.jp/sitemap.xml",
  };
}
