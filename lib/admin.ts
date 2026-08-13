import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export function adminEmails() {
  return (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

export async function requireAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, isActive: true } });
  if (!user || !user.isActive) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/projects");
  return { id: user.id, email: user.email };
}

export async function requireAdminApi() {
  const session = await auth();
  if (!session?.user?.id) return { error: apiError("UNAUTHORIZED", "请先登录", 401) } as const;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, isActive: true } });
  if (!user) return { error: apiError("UNAUTHORIZED", "请先登录", 401) } as const;
  if (!user.isActive) return { error: apiError("ACCOUNT_DISABLED", "账号已被停用", 403) } as const;
  if (!isAdminEmail(user.email)) return { error: apiError("FORBIDDEN", "无权访问管理功能", 403) } as const;
  return { user } as const;
}
