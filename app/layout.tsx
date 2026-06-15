import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Filtr",
  description: "Concise intelligence briefs from noisy web pages."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
