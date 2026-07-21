import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { apiError } from "@/lib/api";

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const configured = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return configured.includes(email.trim().toLowerCase());
}

export async function requireAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isAdminEmail(session.user.email)) redirect("/projects");
  return session.user;
}

export async function requireAdminApi() {
  const session = await auth();
  if (!session?.user?.id) return { error: apiError("UNAUTHORIZED", "请先登录", 401) } as const;
  if (!isAdminEmail(session.user.email)) return { error: apiError("FORBIDDEN", "无权访问管理功能", 403) } as const;
  return { user: session.user } as const;
}
