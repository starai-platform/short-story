import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({ code: z.string().trim().min(4).max(64).transform((value) => value.toUpperCase()) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "请先登录", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "请输入有效兑换码", 400);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const code = await tx.redemptionCode.findUnique({ where: { code: parsed.data.code } });
      if (!code || !code.isActive || code.usedCount >= code.maxUses || (code.expiresAt && code.expiresAt <= new Date())) throw new Error("CODE_INVALID");
      const duplicate = await tx.redemptionRecord.findUnique({ where: { codeId_userId: { codeId: code.id, userId: session.user.id } } });
      if (duplicate) throw new Error("CODE_USED");
      const user = await tx.user.update({ where: { id: session.user.id }, data: { points: { increment: code.points } }, select: { points: true } });
      await tx.redemptionCode.update({ where: { id: code.id }, data: { usedCount: { increment: 1 } } });
      await tx.redemptionRecord.create({ data: { codeId: code.id, userId: session.user.id, points: code.points } });
      await tx.pointTransaction.create({ data: { userId: session.user.id, type: "RECHARGE", amount: code.points, balanceAfter: user.points, description: `兑换码充值 ${code.code}`, referenceId: code.id } });
      return { points: code.points.toString(), balance: user.points.toString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "CODE_USED") return apiError("CONFLICT", "该兑换码你已经使用过", 409);
    if (error instanceof Error && error.message === "CODE_INVALID") return apiError("VALIDATION_ERROR", "兑换码无效、已用完或已过期", 400);
    return apiError("INTERNAL_ERROR", "兑换失败，请稍后重试", 500);
  }
}
