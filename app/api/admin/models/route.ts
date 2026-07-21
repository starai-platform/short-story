import { z } from "zod";
import { requireAdminApi } from "@/lib/admin";
import { apiError } from "@/lib/api";
import { encryptApiKey } from "@/lib/model-secret";
import { prisma } from "@/lib/prisma";

const modelSchema = z.object({
  name: z.string().trim().min(1).max(80), model: z.string().trim().min(1).max(120),
  baseUrl: z.string().trim().url(), apiKey: z.string().trim().min(1).max(500),
  inputPricePerMillion: z.coerce.number().min(0).max(100000), outputPricePerMillion: z.coerce.number().min(0).max(100000),
  billingMultiplier: z.coerce.number().min(0.01).max(100), isDefault: z.boolean().default(false), isFallback: z.boolean().default(false), isActive: z.boolean().default(true),
});

export async function GET() {
  const admin = await requireAdminApi(); if ("error" in admin) return admin.error;
  const models = await prisma.aiModel.findMany({ orderBy: [{ isDefault: "desc" }, { isFallback: "desc" }, { createdAt: "asc" }] });
  return Response.json({ data: models.map(({ apiKeyEncrypted, ...item }) => ({ ...item, inputPricePerMillion: item.inputPricePerMillion.toString(), outputPricePerMillion: item.outputPricePerMillion.toString(), billingMultiplier: item.billingMultiplier.toString(), hasApiKey: Boolean(apiKeyEncrypted) })) });
}

export async function POST(request: Request) {
  const admin = await requireAdminApi(); if ("error" in admin) return admin.error;
  const parsed = modelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "模型参数不正确", 400, parsed.error.flatten());
  const { apiKey, ...data } = parsed.data;
  const model = await prisma.$transaction(async (tx) => {
    if (data.isDefault) await tx.aiModel.updateMany({ data: { isDefault: false } });
    if (data.isFallback) await tx.aiModel.updateMany({ data: { isFallback: false } });
    return tx.aiModel.create({ data: { ...data, apiKeyEncrypted: encryptApiKey(apiKey) } });
  });
  return Response.json({ data: { id: model.id } }, { status: 201 });
}
