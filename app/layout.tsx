import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import SiteHeader from "./_components/SiteHeader";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans-display",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-serif-display",
  subsets: ["latin"],
});

const SITE_URL = "https://mothers-day-mvp.vercel.app";
const OG_IMAGE = `${SITE_URL}/og.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Mother's Day Messages",
  description: "5 minutes for you. Mother's Day nailed. Free.",
  openGraph: {
    title: "Mother's Day. Handled.",
    description:
      "4 questions. 5 minutes. She gets messages all weekend and a page that stays online for a full year. Free.",
    url: SITE_URL,
    siteName: "Mother's Day Messages",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Mother's Day. Handled.",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mother's Day. Handled.",
    description: "4 questions. 5 minutes. Free.",
    images: [OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full flex flex-col font-sans text-gray-950 bg-white">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
