import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth-user";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [account, settings] = await Promise.all([prisma.user.findUnique({ where: { id: user.id }, select: { points: true } }), getSiteSettings()]);
  return <AppShell email={user.email || ""} points={account?.points.toString() || "0"} isAdmin={isAdminEmail(user.email)} siteName={settings.siteName} logoUrl={settings.logoUrl}>{children}</AppShell>;
}
