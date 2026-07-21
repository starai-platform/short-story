import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { LlmUsage, ResolvedModel } from "@/lib/llm";

export function calculatePoints(model: ResolvedModel, usage: LlmUsage) {
  const input = new Prisma.Decimal(usage.inputTokens || 0).div(1_000_000).mul(model.inputPricePerMillion);
  const output = new Prisma.Decimal(usage.outputTokens || 0).div(1_000_000).mul(model.outputPricePerMillion);
  return input.add(output).mul(model.billingMultiplier).toDecimalPlaces(6, Prisma.Decimal.ROUND_UP);
}

export async function assertCanGenerate(userId: string, model: ResolvedModel) {
  if (model.inputPricePerMillion === 0 && model.outputPricePerMillion === 0) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { points: true, isActive: true } });
  if (!user?.isActive) throw new Error("ACCOUNT_DISABLED");
  if (user.points.lte(0)) throw new Error("INSUFFICIENT_POINTS");
}

export async function chargeUsage(userId: string, model: ResolvedModel, usage: LlmUsage, referenceId: string, description: string) {
  const cost = calculatePoints(model, usage);
  if (cost.lte(0)) return cost;
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: userId }, data: { points: { decrement: cost } }, select: { points: true } });
    await tx.pointTransaction.create({
      data: { userId, type: "CONSUMPTION", amount: cost.negated(), balanceAfter: user.points, description, referenceId },
    });
  });
  return cost;
}
