import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/prisma";

export const defaultSiteSettings = {
  siteName: "章回",
  logoUrl: "",
  faviconUrl: "",
  siteTitle: "章回｜AI 短篇小说生成器",
  siteDescription: "规划并生成 10–50 章、10 万字以内的完整中文小说。",
  footerCopyright: "让每一个灵感，都有机会成为完整作品。",
};

export async function getSiteSettings() {
  noStore();
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  return settings ? {
    siteName: settings.siteName,
    logoUrl: settings.logoUrl,
    faviconUrl: settings.faviconUrl,
    siteTitle: settings.siteTitle,
    siteDescription: settings.siteDescription,
    footerCopyright: settings.footerCopyright,
  } : defaultSiteSettings;
}
