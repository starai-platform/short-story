import { z } from "zod";
import { requireAdminApi } from "@/lib/admin";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({ isActive: z.boolean().optional(), expiresAt: z.string().datetime().nullable().optional(), note: z.string().trim().max(200).optional() });
export async function PATCH(request: Request, { params }: Context) {
  const admin = await requireAdminApi(); if ("error" in admin) return admin.error;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return apiError("VALIDATION_ERROR", "兑换码参数不正确", 400);
  const { id } = await params; const result = await prisma.redemptionCode.updateMany({ where: { id }, data: { ...parsed.data, ...(parsed.data.expiresAt !== undefined ? { expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null } : {}) } });
  if (!result.count) return apiError("NOT_FOUND", "兑换码不存在", 404);
  return Response.json({ data: { success: true } });
}
