import { describe, expect, it } from "vitest";
import { calculatePoints } from "@/lib/billing";
import type { ResolvedModel } from "@/lib/llm";

describe("算力点计费", () => {
  it("按实际输入输出 Token 价格和倍率计算", () => {
    const model: ResolvedModel = { id: "m1", name: "测试模型", model: "test", baseUrl: "https://example.test/v1", apiKey: "secret", inputPricePerMillion: 2, outputPricePerMillion: 8, billingMultiplier: 1.5 };
    const cost = calculatePoints(model, { inputTokens: 100_000, outputTokens: 50_000, totalTokens: 150_000 });
    expect(cost.toString()).toBe("0.9");
  });

  it("对极小费用向上保留六位，避免免费消耗", () => {
    const model: ResolvedModel = { id: "m1", name: "测试模型", model: "test", baseUrl: "https://example.test/v1", apiKey: "secret", inputPricePerMillion: 1, outputPricePerMillion: 1, billingMultiplier: 1 };
    expect(calculatePoints(model, { outputTokens: 1 }).toString()).toBe("0.000001");
  });
});
