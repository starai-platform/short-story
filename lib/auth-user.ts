import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, isActive: true } });
  if (!user || !user.isActive) redirect("/login");
  return { id: user.id, email: user.email };
}

export async function requireActiveApi() {
  const session = await auth();
  if (!session?.user?.id) return { error: apiError("UNAUTHORIZED", "请先登录", 401) } as const;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, isActive: true } });
  if (!user) return { error: apiError("UNAUTHORIZED", "请先登录", 401) } as const;
  if (!user.isActive) return { error: apiError("ACCOUNT_DISABLED", "账号已被停用", 403) } as const;
  return { user } as const;
}
