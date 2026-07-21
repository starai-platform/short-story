import { z } from "zod";

export const PROMPT_VARIABLES = ["theme", "protagonist", "worldSetting", "keywords", "style", "pov", "pace", "ending", "constraints", "targetLength"] as const;
const variableSet = new Set<string>(PROMPT_VARIABLES);

export const promptTypeSchema = z.object({
  name: z.string().trim().min(1, "请输入名称").max(60, "名称不能超过 60 字"),
  description: z.string().trim().max(300, "描述不能超过 300 字").default(""),
  outlineTemplate: z.string().trim().min(20, "大纲 Prompt 至少需要 20 个字符").max(6000, "大纲 Prompt 不能超过 6000 字"),
  chapterTemplate: z.string().trim().min(20, "章节 Prompt 至少需要 20 个字符").max(6000, "章节 Prompt 不能超过 6000 字"),
  isActive: z.boolean().default(true),
});

export const generationInputSchema = z.object({
  promptTypeId: z.string().min(1),
  theme: z.string().trim().min(1, "请输入故事主题").max(200, "主题不能超过 200 字"),
  protagonist: z.string().trim().max(300).default(""),
  worldSetting: z.string().trim().max(400).default(""),
  keywords: z.array(z.string().trim().min(1).max(30)).max(10, "关键词最多 10 个").default([]),
  style: z.string().trim().min(1).max(80),
  pov: z.string().trim().min(1).max(40),
  pace: z.string().trim().max(40).default("张弛有度"),
  ending: z.string().trim().max(40).default("完整收束"),
  constraints: z.string().trim().max(300).default(""),
  targetLength: z.number().int().min(1000).max(6000).default(3000),
});

export type GenerationInput = z.infer<typeof generationInputSchema>;

export function findUnknownVariables(template: string) {
  const matches = template.matchAll(/{{\s*([a-zA-Z][\w]*)\s*}}/g);
  return [...new Set([...matches].map((match) => match[1]).filter((name) => !variableSet.has(name)))];
}

export function validateTemplate(template: string) {
  const unknown = findUnknownVariables(template);
  if (unknown.length) {
    return { valid: false as const, unknown };
  }
  return { valid: true as const, unknown: [] as string[] };
}

export function renderPrompt(template: string, input: GenerationInput) {
  const values: Record<(typeof PROMPT_VARIABLES)[number], string> = {
    theme: input.theme,
    protagonist: input.protagonist || "由模型根据主题设计",
    worldSetting: input.worldSetting || "由模型根据类型合理设计",
    keywords: input.keywords.length ? input.keywords.join("、") : "无指定关键词",
    style: input.style,
    pov: input.pov,
    pace: input.pace,
    ending: input.ending,
    constraints: input.constraints || "无额外限制",
    targetLength: String(input.targetLength),
  };

  return template.slice(0, 6000).replace(/{{\s*([a-zA-Z][\w]*)\s*}}/g, (original, key: string) =>
    variableSet.has(key) ? values[key as keyof typeof values] : original,
  );
}

export const STORY_SYSTEM_PROMPT = `你是一名专业中文短篇小说作家。你需要在内部完成故事构思、人物设计、结构安排和伏笔检查，但绝不能展示分析过程、提纲、JSON 或写作说明。最终只输出作品标题和完整正文。故事必须有明确开端、推进、高潮和结局，人物与细节前后一致，不要用“未完待续”收尾。`;
