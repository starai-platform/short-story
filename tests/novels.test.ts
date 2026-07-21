import { describe, expect, it } from "vitest";
import { buildChapterContinuationPrompt, buildChapterPrompt, buildNovelOutlineResponseFormat, buildOutlinePrompt, getMinimumChapterWords, novelOutlineSchema, novelProjectInputSchema, OutlineOutputError, parseChapterOutput, parseModelJson, parseNovelOutline } from "@/lib/novels";

describe("Novel project constraints", () => {
  const base = { promptTypeId: "p1", theme: "一名记者调查雨城所有人共同遗忘的一天", keywords: ["雨城"], style: "冷峻简洁", pov: "第三人称限知", chapterCount: 20, targetWords: 50000 };
  it("accepts 10–50 chapters and at most 100k words", () => {
    expect(novelProjectInputSchema.safeParse(base).success).toBe(true);
    expect(novelProjectInputSchema.safeParse({ ...base, chapterCount: 9 }).success).toBe(false);
    expect(novelProjectInputSchema.safeParse({ ...base, chapterCount: 51 }).success).toBe(false);
    expect(novelProjectInputSchema.safeParse({ ...base, targetWords: 105000 }).success).toBe(false);
  });
  it("keeps chapter targets between 2000 and 5000 words", () => {
    expect(novelProjectInputSchema.safeParse({ ...base, chapterCount: 10, targetWords: 100000 }).success).toBe(false);
    expect(novelProjectInputSchema.safeParse({ ...base, chapterCount: 50, targetWords: 50000 }).success).toBe(false);
    expect(novelProjectInputSchema.safeParse({ ...base, chapterCount: 10, targetWords: 15000 }).success).toBe(false);
  });
});

describe("Model output parsing", () => {
  it("parses fenced outline JSON", () => {
    expect(parseModelJson("```json\n{\"title\":\"雨城\"}\n```")) .toEqual({ title: "雨城" });
  });
  it("validates a multi-chapter outline", () => {
    const chapters = Array.from({ length: 10 }, (_, index) => ({ number: index + 1, title: `第${index + 1}章`, summary: "这一章包含足够长度的剧情描述并推动故事主线继续发展。", beats: ["冲突出现", "局势发生变化"] }));
    expect(novelOutlineSchema.safeParse({ title: "雨城", synopsis: "这是一段足够长的全书梗概，用来说明主要人物如何调查共同失忆事件，并在层层追查中发现城市秘密，最终面对真相、责任与个人选择。", characters: [{ name: "林默", role: "调查共同失忆事件的记者", arc: "从只相信证据到愿意承担真相带来的责任" }], chapters }).success).toBe(true);
  });
  it("requests an exact chapter count through JSON Schema", () => {
    const format = buildNovelOutlineResponseFormat(20);
    const chapters = format.json_schema.schema.properties.chapters;
    expect(chapters.minItems).toBe(20);
    expect(chapters.maxItems).toBe(20);
    expect(format.json_schema.strict).toBe(true);
  });
  it("distinguishes malformed JSON from an invalid outline structure", () => {
    expect(() => parseNovelOutline("这不是 JSON", 10)).toThrowError(expect.objectContaining<Partial<OutlineOutputError>>({ code: "OUTLINE_FORMAT_ERROR" }));
    expect(() => parseNovelOutline('{"title":"雨城"}', 10)).toThrowError(expect.objectContaining<Partial<OutlineOutputError>>({ code: "OUTLINE_STRUCTURE_ERROR" }));
  });
  it("normalizes verbose or terse fields instead of rejecting a usable outline", () => {
    const chapters = Array.from({ length: 10 }, (_, index) => ({
      number: index + 1,
      title: `第${index + 1}章`,
      summary: index === 0 ? "转折" : "长".repeat(1800),
      beats: index === 0 ? ["发现线索"] : ["冲突出现", "局势变化"],
    }));
    const parsed = parseNovelOutline(JSON.stringify({
      title: "雨城",
      synopsis: "记者追查失忆事件。",
      characters: [{ name: "林默", role: "记者", arc: "承担真相" }],
      chapters,
    }), 10);
    expect(parsed.chapters[0].summary.length).toBeGreaterThanOrEqual(20);
    expect(parsed.chapters[0].beats).toHaveLength(2);
    expect(parsed.chapters[1].summary).toHaveLength(1200);
  });
  it("separates title, body and continuity summary", () => {
    const parsed = parseChapterOutput("<<<TITLE>>>\n雨落之前\n<<<BODY>>>\n这是本章正文。\n<<<SUMMARY>>>\n记者发现了旧录音。", "备用标题", "备用摘要");
    expect(parsed).toEqual({ title: "雨落之前", content: "这是本章正文。", summary: "记者发现了旧录音。" });
  });
  it("includes prior summaries and last chapter ending in the next prompt", () => {
    const context = {
      project: { title: "雨城", theme: "失忆", protagonist: "调查真相的记者", worldSetting: "所有人遗忘同一天的雨城", pace: "单线紧凑", ending: "终局反转", constraints: "避免超自然解释", synopsis: "全城失去一天记忆", style: "冷峻", pov: "第三人称", targetWords: 30000, chapterCount: 10, characters: [], outline: { chapters: [{ number: 2, title: "录音", summary: "发现录音" }] }, chapterPromptSnapshot: "章节必须突出雨声意象，主题为 {{theme}}，本章约 {{targetLength}} 字。", promptTypeId: "p1", keywords: [] },
      chapter: { number: 2, title: "录音", outlineSummary: "发现被删除的录音", beats: ["进入档案馆", "找到录音"] },
      previous: [{ number: 1, title: "雨", generationSummary: "记者抵达雨城。", content: "门在他身后自己关上了。" }],
    };
    const prompt = buildChapterPrompt(context);
    expect(prompt).toContain("记者抵达雨城");
    expect(prompt).toContain("门在他身后自己关上了");
    expect(prompt).toContain("章节必须突出雨声意象，主题为 失忆，本章约 3000 字");
    expect(prompt).toContain("正文不得少于 2550 个中文字");

    const continuation = buildChapterContinuationPrompt(context, "已有正文".repeat(200));
    expect(continuation).toContain("只续写新内容");
    expect(continuation).toContain("最低要求 2550 字");
  });
  it("never accepts fewer than 2000 characters as a completed chapter", () => {
    expect(getMinimumChapterWords(50000, 20)).toBe(2125);
    expect(getMinimumChapterWords(20000, 10)).toBe(2000);
  });
  it("assigns distinct retention jobs to the first three chapters", () => {
    const project = { title: "雨城", theme: "失忆", protagonist: "记者", worldSetting: "雨城", pace: "紧凑", ending: "反转", constraints: "无", synopsis: "调查失忆", style: "冷峻", pov: "第三人称", targetWords: 30000, chapterCount: 10, characters: [], outline: { chapters: [] }, chapterPromptSnapshot: "类型规则", promptTypeId: "p1", keywords: [] };
    const makePrompt = (number: number) => buildChapterPrompt({ project, chapter: { number, title: `第${number}章`, outlineSummary: "推进主线", beats: ["行动", "变化"] }, previous: [] });
    expect(makePrompt(1)).toContain("前 200–300 字内");
    expect(makePrompt(2)).toContain("部分兑现第1章结尾");
    expect(makePrompt(3)).toContain("第一次有分量的爽点");
  });
  it("keeps hook planning explicit without expanding the outline schema", () => {
    const input = novelProjectInputSchema.parse({ promptTypeId: "p1", theme: "一名记者调查雨城所有人共同遗忘的一天", keywords: ["雨城"], style: "冷峻简洁", pov: "第三人称限知", chapterCount: 20, targetWords: 50000 });
    const prompt = buildOutlinePrompt(input, "类型规则");
    expect(prompt).toContain("第1章：前段直接出现异常");
    expect(prompt).toContain("第3章：交付第一次显著爽点");
    expect(prompt).toContain("summary 用 50–100 字");
    expect(prompt).not.toContain('"hook"');
  });
  it("compresses a 50-chapter context instead of sending full verbose summaries", () => {
    const outlineChapters = Array.from({ length: 50 }, (_, index) => ({ number: index + 1, title: `章节${index + 1}`, summary: "大纲".repeat(600), beats: ["推进", "转折"] }));
    const previous = Array.from({ length: 49 }, (_, index) => ({ number: index + 1, title: `章节${index + 1}`, generationSummary: "前情".repeat(300), content: "上一章结尾".repeat(300) }));
    const prompt = buildChapterPrompt({
      project: { title: "长线测试", theme: "测试上下文", protagonist: "主角", worldSetting: "世界", pace: "多线交织", ending: "完整收束", constraints: "无", synopsis: "全书梗概", style: "细腻自然", pov: "第三人称限知", targetWords: 100000, chapterCount: 50, characters: [], outline: { title: "长线测试", synopsis: "全书梗概", characters: [], chapters: outlineChapters }, chapterPromptSnapshot: "类型规则".repeat(3000), promptTypeId: "p1", keywords: [] },
      chapter: { number: 50, title: "终章", outlineSummary: "完成最终冲突", beats: ["对决", "收束"] },
      previous,
    });
    expect(prompt.length).toBeLessThan(35000);
  });
});
