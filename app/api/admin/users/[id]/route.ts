import { z } from "zod";
import { requireAdminApi } from "@/lib/admin";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({ isActive: z.boolean().optional(), adjustment: z.coerce.number().min(-1000000).max(1000000).optional(), note: z.string().trim().max(200).optional() });

export async function PATCH(request: Request, { params }: Context) {
  const admin = await requireAdminApi(); if ("error" in admin) return admin.error;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return apiError("VALIDATION_ERROR", "用户参数不正确", 400);
  const { id } = await params;
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id } }); if (!existing) throw new Error("NOT_FOUND");
    const user = await tx.user.update({ where: { id }, data: { ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}), ...(parsed.data.adjustment ? { points: { increment: parsed.data.adjustment } } : {}) } });
    if (parsed.data.adjustment) await tx.pointTransaction.create({ data: { userId: id, type: "ADJUSTMENT", amount: parsed.data.adjustment, balanceAfter: user.points, description: parsed.data.note || "管理员调整算力点" } });
    return user;
  }).catch((error) => { if (error instanceof Error && error.message === "NOT_FOUND") return null; throw error; });
  if (!result) return apiError("NOT_FOUND", "用户不存在", 404);
  return Response.json({ data: { points: result.points.toString(), isActive: result.isActive } });
}
