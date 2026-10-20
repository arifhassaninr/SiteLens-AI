import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SiteLens — Website Performance & SEO Audit",
  description:
    "Check real Google Lighthouse performance, accessibility, SEO, and best practices scores, then get actionable improvements.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
