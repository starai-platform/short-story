import { describe, expect, it } from "vitest";
import { findUnknownVariables, generationInputSchema, promptTypeSchema, renderPrompt, validateTemplate } from "@/lib/prompts";

const input = {
  promptTypeId: "prompt-1",
  theme: "雨夜书店",
  protagonist: "失去部分记忆的旧书店员",
  worldSetting: "常年下雨的现代小城",
  keywords: ["旧书", "记忆"],
  style: "克制自然",
  pov: "第一人称",
  pace: "慢热沉浸",
  ending: "开放余韵",
  constraints: "避免超自然解释",
  targetLength: 3000,
};

describe("Prompt templates", () => {
  it("renders all supported placeholders", () => {
    expect(renderPrompt("{{theme}}|{{ keywords }}|{{style}}|{{pov}}|{{targetLength}}", input)).toBe("雨夜书店|旧书、记忆|克制自然|第一人称|3000");
  });

  it("renders bounded novel-setting placeholders", () => {
    expect(renderPrompt("{{protagonist}}|{{worldSetting}}|{{pace}}|{{ending}}|{{constraints}}", input)).toBe("失去部分记忆的旧书店员|常年下雨的现代小城|慢热沉浸|开放余韵|避免超自然解释");
  });

  it("reports unique unknown placeholders", () => {
    expect(findUnknownVariables("{{theme}} {{tone}} {{tone}} {{custom}}")) .toEqual(["tone", "custom"]);
    expect(validateTemplate("{{theme}} {{unknown}}")).toEqual({ valid: false, unknown: ["unknown"] });
  });

  it("allows templates that omit common fields", () => {
    expect(validateTemplate("只使用主题：{{theme}}").valid).toBe(true);
  });

  it("caps rendered custom templates to protect the model context", () => {
    expect(renderPrompt("规".repeat(7000), input)).toHaveLength(6000);
  });

  it("requires separate outline and chapter templates", () => {
    const valid = { name: "悬疑", description: "", outlineTemplate: "这是用于规划完整小说大纲的 Prompt 模板。", chapterTemplate: "这是用于逐章生成小说正文的 Prompt 模板。", isActive: true };
    expect(promptTypeSchema.safeParse(valid).success).toBe(true);
    expect(promptTypeSchema.safeParse({ ...valid, chapterTemplate: "" }).success).toBe(false);
  });
});

describe("Generation input", () => {
  it("accepts the supported length range", () => {
    expect(generationInputSchema.parse(input).targetLength).toBe(3000);
  });

  it("rejects too many keywords and oversized stories", () => {
    expect(generationInputSchema.safeParse({ ...input, keywords: Array(11).fill("词") }).success).toBe(false);
    expect(generationInputSchema.safeParse({ ...input, targetLength: 6500 }).success).toBe(false);
  });
});
