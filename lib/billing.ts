import { Prisma, type PrismaClient } from "@prisma/client";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { LlmUsage, ResolvedModel } from "@/lib/llm";

type DbClient = Prisma.TransactionClient | PrismaClient;

export function calculatePoints(model: ResolvedModel, usage: LlmUsage) {
  const input = new Prisma.Decimal(usage.inputTokens || 0).div(1_000_000).mul(model.inputPricePerMillion);
  const output = new Prisma.Decimal(usage.outputTokens || 0).div(1_000_000).mul(model.outputPricePerMillion);
  return input.add(output).mul(model.billingMultiplier).toDecimalPlaces(6, Prisma.Decimal.ROUND_UP);
}

function isPaidModel(model: ResolvedModel) {
  return model.inputPricePerMillion > 0 || model.outputPricePerMillion > 0;
}

export async function assertCanGenerate(userId: string, ...models: ResolvedModel[]) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { points: true, isActive: true } });
  if (!user?.isActive) throw new Error("ACCOUNT_DISABLED");
  if (models.some(isPaidModel) && user.points.lte(0)) throw new Error("INSUFFICIENT_POINTS");
}

export async function chargeUsage(
  userId: string,
  model: ResolvedModel,
  usage: LlmUsage,
  referenceId: string,
  description: string,
  client?: DbClient,
) {
  const cost = calculatePoints(model, usage);
  if (cost.lte(0)) return cost;
  const run = async (tx: DbClient) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, isActive: true, points: { gte: cost } },
      data: { points: { decrement: cost } },
    });
    if (!updated.count) {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { isActive: true } });
      if (!user?.isActive) throw new Error("ACCOUNT_DISABLED");
      throw new Error("INSUFFICIENT_POINTS");
    }
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } });
    await tx.pointTransaction.create({
      data: { userId, type: "CONSUMPTION", amount: cost.negated(), balanceAfter: user.points, description, referenceId },
    });
    return cost;
  };
  if (client) return run(client);
  return prisma.$transaction((tx) => run(tx));
}

export function billingErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "INSUFFICIENT_POINTS") {
    return apiError("INSUFFICIENT_POINTS", "算力点不足，请先使用兑换码充值", 402);
  }
  if (error instanceof Error && error.message === "ACCOUNT_DISABLED") {
    return apiError("ACCOUNT_DISABLED", "账号已被停用", 403);
  }
  return apiError("PROVIDER_ERROR", "模型服务尚未正确配置", 503);
}
