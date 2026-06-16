// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

const APP_URL = "https://filtr-sand.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Filtr — Extract what matters.",
    template: "%s | Filtr",
  },
  description:
    "Filtr strips news articles down to what actually matters. Paste any URL and get a concise, bias-aware intelligence brief — Reuters discipline, analyst edge.",
  keywords: ["news analysis", "article summary", "media bias", "intelligence brief", "fact check"],
  authors: [{ name: "Filtr" }],
  creator: "Filtr",

  // Favicon / icons — Next.js reads these from app/ or public/
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },

  // Open Graph (Facebook, LinkedIn, Slack, iMessage previews)
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "Filtr",
    title: "Filtr — Extract what matters.",
    description:
      "Strip the story down to what matters. Filtr extracts articles, scores narrative framing, flags weak claims, and returns a practical brief built for decisions.",
    images: [
      {
        url: "/logo.png",
        width: 1536,
        height: 1024,
        alt: "Filtr — extract what matters.",
      },
    ],
  },

  // Twitter / X card
  twitter: {
    card: "summary_large_image",
    title: "Filtr — Extract what matters.",
    description:
      "Strip the story down to what matters. Intelligence briefs from noisy pages.",
    images: ["/logo.png"],
  },

  // Prevent search engines from indexing the app until you're ready for public launch
  // Remove this line (or set index: true) when you want Google to find you
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
