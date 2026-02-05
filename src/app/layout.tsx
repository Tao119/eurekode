import type { Metadata } from "next";
import { Inter, Noto_Sans_JP, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/providers/SessionProvider";
import {
  WebsiteJsonLd,
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
} from "@/components/seo/JsonLd";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const siteUrl = "https://www.eurecode.jp";
const siteName = "Eurecode";
const siteDescription =
  "Eurecodeは「コードを渡すのではなく、思考プロセスを渡す」をコンセプトとした、プログラミング学習支援AIチャットサービスです。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Eurecode - 思考を渡す学習プラットフォーム",
    template: "%s | Eurecode",
  },
  description: siteDescription,
  keywords: [
    "プログラミング学習",
    "AI学習",
    "コーディング",
    "教育",
    "メンター",
    "プログラミング",
    "学習プラットフォーム",
    "AIチャット",
    "コードレビュー",
    "プログラミング初心者",
  ],
  authors: [{ name: siteName, url: siteUrl }],
  creator: siteName,
  publisher: siteName,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: siteUrl,
    siteName,
    title: "Eurecode - 思考を渡す学習プラットフォーム",
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "Eurecode - 思考を渡す学習プラットフォーム",
    description: siteDescription,
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
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body
        className={`${inter.variable} ${notoSansJP.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <SessionProvider>
          {children}
          <Toaster />
        </SessionProvider>
        <WebsiteJsonLd
          url={siteUrl}
          name={siteName}
          description={siteDescription}
        />
        <OrganizationJsonLd
          url={siteUrl}
          name={siteName}
          logo={`${siteUrl}/icon-512.png`}
          description={siteDescription}
        />
        <SoftwareApplicationJsonLd
          name={siteName}
          description={siteDescription}
          url={siteUrl}
          applicationCategory="EducationalApplication"
          operatingSystem="Web"
          offers={{ price: "0", priceCurrency: "JPY" }}
        />
      </body>
    </html>
  );
}
