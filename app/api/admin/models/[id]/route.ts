import { z } from "zod";
import { requireAdminApi } from "@/lib/admin";
import { apiError } from "@/lib/api";
import { encryptApiKey } from "@/lib/model-secret";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({ name: z.string().trim().min(1).max(80).optional(), model: z.string().trim().min(1).max(120).optional(), baseUrl: z.string().trim().url().optional(), apiKey: z.string().trim().min(1).max(500).optional(), inputPricePerMillion: z.coerce.number().min(0).max(100000).optional(), outputPricePerMillion: z.coerce.number().min(0).max(100000).optional(), billingMultiplier: z.coerce.number().min(0.01).max(100).optional(), isDefault: z.boolean().optional(), isFallback: z.boolean().optional(), isActive: z.boolean().optional() });

export async function PATCH(request: Request, { params }: Context) {
  const admin = await requireAdminApi(); if ("error" in admin) return admin.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "模型参数不正确", 400);
  const { id } = await params; const { apiKey, ...data } = parsed.data;
  const exists = await prisma.aiModel.findUnique({ where: { id } }); if (!exists) return apiError("NOT_FOUND", "模型不存在", 404);
  await prisma.$transaction(async (tx) => {
    if (data.isDefault) await tx.aiModel.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
    if (data.isFallback) await tx.aiModel.updateMany({ where: { id: { not: id } }, data: { isFallback: false } });
    await tx.aiModel.update({ where: { id }, data: { ...data, ...(apiKey ? { apiKeyEncrypted: encryptApiKey(apiKey) } : {}) } });
  });
  return Response.json({ data: { success: true } });
}

export async function DELETE(_: Request, { params }: Context) {
  const admin = await requireAdminApi(); if ("error" in admin) return admin.error;
  const { id } = await params; const result = await prisma.aiModel.deleteMany({ where: { id } });
  if (!result.count) return apiError("NOT_FOUND", "模型不存在", 404);
  return Response.json({ data: { success: true } });
}
