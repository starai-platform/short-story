import { z } from "zod";
import { requireAdminApi } from "@/lib/admin";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  siteName: z.string().trim().min(1).max(40),
  logoUrl: z.string().trim().max(500),
  faviconUrl: z.string().trim().max(500),
  siteTitle: z.string().trim().min(1).max(100),
  siteDescription: z.string().trim().min(1).max(300),
  footerCopyright: z.string().trim().min(1).max(200),
});

export async function GET() {
  const admin = await requireAdminApi(); if ("error" in admin) return admin.error;
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  return Response.json({ data: settings });
}

export async function PATCH(request: Request) {
  const admin = await requireAdminApi(); if ("error" in admin) return admin.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "系统设置参数不正确", 400);
  const settings = await prisma.systemSettings.upsert({ where: { id: "default" }, create: { id: "default", ...parsed.data }, update: parsed.data });
  return Response.json({ data: settings });
}
