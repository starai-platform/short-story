import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site-settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return { title: settings.siteTitle, description: settings.siteDescription, icons: settings.faviconUrl ? { icon: settings.faviconUrl } : undefined };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
