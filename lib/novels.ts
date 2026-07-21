import { z } from "zod";
import { renderPrompt, type GenerationInput } from "@/lib/prompts";

export const novelProjectInputSchema = z.object({
  promptTypeId: z.string().min(1),
  theme: z.string().trim().min(10, "请至少用 10 个字描述故事").max(1000),
  protagonist: z.string().trim().max(300).default(""),
  worldSetting: z.string().trim().max(400).default(""),
  keywords: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  style: z.string().trim().min(1).max(80),
  pov: z.string().trim().min(1).max(40),
  pace: z.string().trim().min(1).max(40).default("张弛有度"),
  ending: z.string().trim().min(1).max(40).default("完整收束"),
  constraints: z.string().trim().max(300).default(""),
  chapterCount: z.number().int().min(10).max(50),
  targetWords: z.number().int().min(15000).max(100000),
}).superRefine((value, ctx) => {
  const perChapter = value.targetWords / value.chapterCount;
  if (perChapter < 2000 || perChapter > 5000) {
    ctx.addIssue({ code: "custom", path: ["targetWords"], message: "每章目标字数需在 2000–5000 字之间，请调整章节数或总字数" });
  }
});

export type NovelProjectInput = z.infer<typeof novelProjectInputSchema>;

export function normalizeKeywords(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const outlineChapterSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  beats: z.array(z.string().trim().min(1)).min(1),
});

export const novelOutlineSchema = z.object({
  title: z.string().trim().min(1),
  synopsis: z.string().trim().min(1),
  characters: z.array(z.object({
    name: z.string().trim().min(1),
    role: z.string().trim().min(1),
    arc: z.string().trim().min(1),
  })).min(1),
  chapters: z.array(outlineChapterSchema).min(10).max(50),
});

export type NovelOutline = z.infer<typeof novelOutlineSchema>;

export type OutlineOutputErrorCode = "OUTLINE_FORMAT_ERROR" | "OUTLINE_STRUCTURE_ERROR";

export class OutlineOutputError extends Error {
  constructor(
    public readonly code: OutlineOutputErrorCode,
    message: string,
    public readonly diagnostic: { issuePaths?: string[]; expectedChapters?: number; actualChapters?: number } = {},
  ) {
    super(message);
    this.name = "OutlineOutputError";
  }
}

export function parseModelJson(text: string) {
  const normalized = text.replace(/^\uFEFF/, "").trim();
  const fenced = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");
  const candidate = fenced ?? (firstBrace >= 0 && lastBrace > firstBrace ? normalized.slice(firstBrace, lastBrace + 1) : normalized);
  return JSON.parse(candidate.trim()) as unknown;
}

export function parseNovelOutline(text: string, expectedChapters: number): NovelOutline {
  let json: unknown;
  try {
    json = parseModelJson(text);
  } catch {
    throw new OutlineOutputError("OUTLINE_FORMAT_ERROR", "模型没有返回有效 JSON 大纲");
  }

  const result = novelOutlineSchema.safeParse(json);
  if (!result.success) {
    throw new OutlineOutputError("OUTLINE_STRUCTURE_ERROR", "模型返回的大纲字段不完整", {
      issuePaths: result.error.issues.slice(0, 8).map((issue) => issue.path.join(".") || "root"),
    });
  }
  if (result.data.chapters.length !== expectedChapters) {
    throw new OutlineOutputError("OUTLINE_STRUCTURE_ERROR", `模型返回的章节数量不是 ${expectedChapters} 章`, {
      expectedChapters,
      actualChapters: result.data.chapters.length,
    });
  }
  const firstWrongNumber = result.data.chapters.findIndex((chapter, index) => chapter.number !== index + 1);
  if (firstWrongNumber >= 0) {
    throw new OutlineOutputError("OUTLINE_STRUCTURE_ERROR", `第 ${firstWrongNumber + 1} 项的章节编号不连续`, {
      issuePaths: [`chapters.${firstWrongNumber}.number`],
    });
  }

  const limit = (value: string, max: number) => value.trim().slice(0, max);
  return {
    title: limit(result.data.title, 100),
    synopsis: limit(result.data.synopsis, 3000),
    characters: result.data.characters.slice(0, 12).map((character) => ({
      name: limit(character.name, 30),
      role: limit(character.role, 300),
      arc: limit(character.arc, 500),
    })),
    chapters: result.data.chapters.map((chapter) => {
      const normalizedBeats = chapter.beats.slice(0, 6).map((beat) => limit(beat, 200));
      if (normalizedBeats.length === 1) normalizedBeats.push("推进本章核心冲突并为后续情节建立承接");
      const enrichedSummary = chapter.summary.length >= 20
        ? chapter.summary
        : `${chapter.summary}。关键进展：${normalizedBeats.join("；")}`;
      return {
        number: chapter.number,
        title: limit(chapter.title, 80),
        summary: limit(enrichedSummary, 1200),
        beats: normalizedBeats,
      };
    }),
  };
}

export function buildNovelOutlineResponseFormat(chapterCount: number) {
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "novel_outline",
      description: `包含 ${chapterCount} 章的完整中文小说大纲`,
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["title", "synopsis", "characters", "chapters"],
        properties: {
          title: { type: "string" },
          synopsis: { type: "string" },
          characters: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "role", "arc"],
              properties: {
                name: { type: "string" },
                role: { type: "string" },
                arc: { type: "string" },
              },
            },
          },
          chapters: {
            type: "array",
            minItems: chapterCount,
            maxItems: chapterCount,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["number", "title", "summary", "beats"],
              properties: {
                number: { type: "integer" },
                title: { type: "string" },
                summary: { type: "string" },
                beats: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
              },
            },
          },
        },
      },
    },
  };
}

export function buildOutlinePrompt(input: NovelProjectInput, template: string) {
  const rendered = renderPrompt(template, {
    promptTypeId: input.promptTypeId,
    theme: input.theme,
    protagonist: input.protagonist,
    worldSetting: input.worldSetting,
    keywords: input.keywords,
    style: input.style,
    pov: input.pov,
    pace: input.pace,
    ending: input.ending,
    constraints: input.constraints,
    targetLength: input.targetWords,
  } satisfies GenerationInput);
  const perChapter = Math.round(input.targetWords / input.chapterCount);
  return `你正在规划一部面向当前中文短篇网文读者的完整小说，而不是慢热的小故事。\n\n小说类型规则：\n---\n${rendered}\n---\n\n核心设定（未填写的项目可自行合理设计）：\n- 主题与主要冲突：${input.theme}\n- 主角设定：${input.protagonist || "未指定"}\n- 世界背景：${input.worldSetting || "未指定"}\n- 关键词：${input.keywords.join("、") || "无"}\n- 风格与视角：${input.style}；${input.pov}\n- 节奏：${input.pace}；结局倾向：${input.ending}\n- 必须包含或避免：${input.constraints || "无额外要求"}\n\n全书要求：\n- 共 ${input.chapterCount} 章，总目标约 ${input.targetWords} 字，每章约 ${perChapter} 字\n- 必须有贯穿全书的主线、阶段性转折、人物弧光和完整结局\n- 钩子必须来自人物目标、危机、秘密、关系变化、身份反差、道德选择或类型核心设定，不能使用与主线无关的假悬念\n- 第1章：前段直接出现异常、冲突或即将付出代价的局面；建立主角当下欲望和核心故事问题，结尾给出不可忽略的新事实或行动\n- 第2章：尽快部分兑现第1章钩子，同时让代价、对手或困难明显升级；禁止重新介绍背景或让危机复位，结尾制造更具体的两难或威胁\n- 第3章：交付第一次显著爽点、真相、关系变化或认知反转，使主角作出不可轻易撤回的选择，正式锁定全书主线\n- 前三章每章都有“承接上一钩子→产生新进展→局势发生变化→留下下一驱动力”，但不能连续使用同一种误会、巧合或强行断章\n- 第4章以后保持兑现与新悬念交替；各章不能是互不关联的单元故事，也不能只挖坑不回收\n- 最后一章必须完成核心冲突和主要伏笔回收\n\n大纲压缩规则：\n- synopsis 只保留主线、核心反转与结局，不写宣传文案\n- summary 用 50–100 字写清本章“谁因为什么采取什么行动，造成什么变化，以及章末驱动力”\n- beats 只列 2–3 个不可删除的剧情节点；前三章的首项写开场抓点、末项写章末驱动力\n- 不要在多个字段重复相同信息，不要输出场景对白和正文细节\n\n严格输出一个 JSON 对象，不要 Markdown，不要解释。结构如下：\n{"title":"书名","synopsis":"全书梗概","characters":[{"name":"姓名","role":"身份与关键设定","arc":"人物弧光"}],"chapters":[{"number":1,"title":"章名","summary":"剧情行动、变化与章末驱动力","beats":["开场或关键行动","转折或章末驱动力"]}]}\n\nchapters 必须恰好包含 ${input.chapterCount} 项，number 从 1 连续递增。`;
}

function chapterRetentionRules(chapterNumber: number) {
  if (chapterNumber === 1) return `前三章留存任务（第1章）：\n- 正文前 200–300 字内让异常、冲突、强烈反差或明确代价真正发生；不要从起床、天气、外貌、世界观说明或大段回忆开始。\n- 尽快让读者知道主角此刻想得到或避免什么，以及失败会失去什么；设定通过行动展示。\n- 本章必须推进到大纲中的实质变化，结尾落在不可忽略的新事实、选择或危险上，不能只靠一句故作神秘的话断章。`;
  if (chapterNumber === 2) return `前三章留存任务（第2章）：\n- 开头直接承接并部分兑现第1章结尾，不复述第一章，不让危机归零。\n- 在兑现中引入更高代价、明确对手或更难选择，让主角主动应对而非被剧情拖行。\n- 结尾的钩子必须比第1章更具体，并由本章行动自然导致。`;
  if (chapterNumber === 3) return `前三章留存任务（第3章）：\n- 本章必须交付第一次有分量的爽点、真相、能力证明、关系质变或认知反转，不能继续只铺垫。\n- 让主角作出不可轻易撤回的决定或承担明确后果，读者能确认全书主线已经启动。\n- 结尾打开下一阶段目标，不使用梦醒、巧合救场或刻意隐藏视角内已知信息。`;
  return `连载留存要求：本章开头承接前章驱动力，中段必须产生有效进展或变化，结尾在兑现本章核心承诺后再建立下一驱动力；避免只挖坑不兑现和机械式句号断章。`;
}

type ChapterContext = {
  project: { title: string; theme: string; protagonist: string; worldSetting: string; pace: string; ending: string; constraints: string; synopsis: string; style: string; pov: string; targetWords: number; chapterCount: number; characters: unknown; outline: unknown; chapterPromptSnapshot: string; promptTypeId: string | null; keywords: unknown };
  chapter: { number: number; title: string; outlineSummary: string; beats: unknown };
  previous: Array<{ number: number; title: string; generationSummary: string; content: string }>;
};

export function getChapterTargetWords(targetWords: number, chapterCount: number) {
  return Math.round(targetWords / chapterCount);
}

export function getMinimumChapterWords(targetWords: number, chapterCount: number) {
  return Math.max(2000, Math.floor(getChapterTargetWords(targetWords, chapterCount) * 0.85));
}

export function buildChapterPrompt({ project, chapter, previous }: ChapterContext) {
  const keywords = normalizeKeywords(project.keywords);
  const perChapter = getChapterTargetWords(project.targetWords, project.chapterCount);
  const minimumWords = getMinimumChapterWords(project.targetWords, project.chapterCount);
  const renderedChapterRules = renderPrompt(project.chapterPromptSnapshot, {
    promptTypeId: project.promptTypeId ?? "snapshot",
    theme: project.theme,
    protagonist: project.protagonist,
    worldSetting: project.worldSetting,
    keywords,
    style: project.style,
    pov: project.pov,
    pace: project.pace,
    ending: project.ending,
    constraints: project.constraints,
    targetLength: perChapter,
  });
  const retentionRules = chapterRetentionRules(chapter.number);
  const chapterRules = `${renderedChapterRules}\n主角设定：${project.protagonist || "按大纲执行"}\n世界背景：${project.worldSetting || "按大纲执行"}\n节奏与结局倾向：${project.pace}；${project.ending}\n额外限制：${project.constraints || "无"}\n\n${retentionRules}`;
  const outline = project.outline as NovelOutline | null;
  const arc = outline?.chapters.map((item) => `${item.number}. ${item.title}：${item.summary.slice(0, 260)}`).join("\n") ?? "";
  const history = previous.map((item) => `第${item.number}章《${item.title}》：${item.generationSummary.slice(0, 240)}`).join("\n") || "这是第一章。";
  const lastEnding = previous.at(-1)?.content.slice(-1600) || "无前文。";
  return `请创作长篇连续小说的第 ${chapter.number}/${project.chapterCount} 章。\n\n本类型的章节创作 Prompt：\n---\n${chapterRules}\n---\n\n书名：${project.title}\n全书梗概：${project.synopsis}\n主要人物：${JSON.stringify(project.characters)}\n文风：${project.style}\n视角：${project.pov}\n本章目标字数：${perChapter} 字，正文不得少于 ${minimumWords} 个中文字。不要用缩写、概述或提前收尾来压缩篇幅。\n\n全书章节路线：\n${arc}\n\n已经发生的剧情摘要：\n${history}\n\n上一章末尾原文：\n${lastEnding}\n\n本章大纲：\n标题：${chapter.title}\n剧情：${chapter.outlineSummary}\n关键节拍：${JSON.stringify(chapter.beats)}\n\n要求：\n1. 直接承接前文，人物状态、信息边界、时间和道具保持一致。\n2. 完整写出场景、行动、对话和心理变化，不能把大纲换一种说法。\n3. 本章完成自己的小转折，同时推进全书主线；除最终章外不要提前结束全书。\n4. 至少展开 3 个有实质推进的场景，正文达到最低字数前不得结束本章。\n5. 不写“本章完”“未完待续”或创作说明。\n6. 正文后提供一段 100–200 字的事实摘要，供下一章保持连续性。\n\n只按以下分隔格式输出：\n<<<TITLE>>>\n本章标题\n<<<BODY>>>\n本章完整正文\n<<<SUMMARY>>>\n本章事实摘要`;
}

export function buildChapterContinuationPrompt({ project, chapter, previous }: ChapterContext, existingContent: string) {
  const keywords = normalizeKeywords(project.keywords);
  const targetWords = getChapterTargetWords(project.targetWords, project.chapterCount);
  const minimumWords = getMinimumChapterWords(project.targetWords, project.chapterCount);
  const remainingWords = Math.max(400, targetWords - existingContent.length);
  const history = previous.map((item) => `第${item.number}章《${item.title}》：${item.generationSummary.slice(0, 240)}`).join("\n") || "这是第一章。";
  const renderedChapterRules = renderPrompt(project.chapterPromptSnapshot, {
    promptTypeId: project.promptTypeId ?? "snapshot",
    theme: project.theme,
    protagonist: project.protagonist,
    worldSetting: project.worldSetting,
    keywords,
    style: project.style,
    pov: project.pov,
    pace: project.pace,
    ending: project.ending,
    constraints: project.constraints,
    targetLength: targetWords,
  });
  const retentionRules = chapterRetentionRules(chapter.number);
  const chapterRules = `${renderedChapterRules}\n主角设定：${project.protagonist || "按大纲执行"}\n世界背景：${project.worldSetting || "按大纲执行"}\n节奏与结局倾向：${project.pace}；${project.ending}\n额外限制：${project.constraints || "无"}\n\n${retentionRules}`;
  return `继续扩写小说《${project.title}》第 ${chapter.number} 章《${chapter.title}》。\n\n章节创作规则：\n${chapterRules}\n\n全书梗概：${project.synopsis}\n主要人物：${JSON.stringify(project.characters)}\n前文章节事实：\n${history}\n\n本章大纲：${chapter.outlineSummary}\n关键节拍：${JSON.stringify(chapter.beats)}\n\n本章已有正文约 ${existingContent.length} 字，完整正文最低要求 ${minimumWords} 字、目标 ${targetWords} 字。请从下面结尾自然接续，再写约 ${remainingWords} 字：\n---\n${existingContent.slice(-4000)}\n---\n\n要求：\n1. 只续写新内容，不得复述、改写或重复已有段落。\n2. 继续展开场景、行动、对话和心理变化，不要用总结快速收尾。\n3. 与已有正文无缝衔接，并完成本章大纲尚未充分展开的关键节拍。\n4. 最后给出覆盖整个本章的 100–200 字事实摘要。\n\n只按以下格式输出：\n<<<BODY>>>\n续写正文\n<<<SUMMARY>>>\n完整章节事实摘要`;
}

export function parseChapterOutput(raw: string, fallbackTitle: string, fallbackSummary: string) {
  const title = raw.match(/<<<TITLE>>>\s*([\s\S]*?)\s*<<<BODY>>>/)?.[1]?.trim() || fallbackTitle;
  const bodyStart = raw.indexOf("<<<BODY>>>");
  const summaryStart = raw.indexOf("<<<SUMMARY>>>");
  const content = bodyStart >= 0
    ? raw.slice(bodyStart + "<<<BODY>>>".length, summaryStart >= 0 ? summaryStart : undefined).trim()
    : raw.replace(/<<<TITLE>>>[\s\S]*?(?=<<<BODY>>>)/, "").trim();
  const summary = summaryStart >= 0 ? raw.slice(summaryStart + "<<<SUMMARY>>>".length).trim() : fallbackSummary;
  return { title, content, summary };
}
