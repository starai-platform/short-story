import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({ code: z.string().trim().max(64).optional(), points: z.coerce.number().positive().max(1000000), maxUses: z.coerce.number().int().min(1).max(100000), expiresAt: z.string().datetime().nullable().optional(), note: z.string().trim().max(200).optional() });

export async function GET() {
  const admin = await requireAdminApi(); if ("error" in admin) return admin.error;
  const codes = await prisma.redemptionCode.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  return Response.json({ data: codes.map((item) => ({ ...item, points: item.points.toString() })) });
}

export async function POST(request: Request) {
  const admin = await requireAdminApi(); if ("error" in admin) return admin.error;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return apiError("VALIDATION_ERROR", "兑换码参数不正确", 400);
  const code = (parsed.data.code || `NOVEL-${randomBytes(5).toString("hex")}`).toUpperCase();
  try {
    const created = await prisma.redemptionCode.create({ data: { code, points: parsed.data.points, maxUses: parsed.data.maxUses, expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null, note: parsed.data.note || "" } });
    return Response.json({ data: { ...created, points: created.points.toString() } }, { status: 201 });
  } catch { return apiError("CONFLICT", "兑换码已存在", 409); }
}
