import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { assertCanGenerate, chargeUsage } from "@/lib/billing";
import { resolveModelChain, streamStory, type LlmUsage, type ResolvedModel } from "@/lib/llm";
import { buildChapterContinuationPrompt, buildChapterPrompt, getMinimumChapterWords, parseChapterOutput } from "@/lib/novels";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 200;

type Context = { params: Promise<{ id: string; number: string }> };
const encoder = new TextEncoder();
const BODY_MARKER = "<<<BODY>>>";
const SUMMARY_MARKER = "<<<SUMMARY>>>";
const CHAPTER_SYSTEM = "你是专业中文类型小说作家，正在逐章创作一部完整且连续的小说。严格服从项目设定和前文事实，不展示分析过程。";
const sse = (type: string, data: unknown) => encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);

export async function POST(_: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "请先登录", 401);
  const { id, number: rawNumber } = await params;
  const number = Number(rawNumber);
  if (!Number.isInteger(number) || number < 1 || number > 50) return apiError("VALIDATION_ERROR", "章节编号不正确", 400);

  let models: ResolvedModel[];
  try {
    models = await resolveModelChain();
    await assertCanGenerate(session.user.id, models[0]);
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_POINTS") return apiError("INSUFFICIENT_POINTS", "算力点不足，请先使用兑换码充值", 402);
    return apiError("PROVIDER_ERROR", "模型服务尚未配置", 503);
  }
  let selectedModel = models[0];
  let model = selectedModel.model;

  const chapter = await prisma.novelChapter.findFirst({
    where: { projectId: id, number, project: { userId: session.user.id } },
    include: { project: true },
  });
  if (!chapter) return apiError("NOT_FOUND", "章节不存在", 404);
  const minimumWords = getMinimumChapterWords(chapter.project.targetWords, chapter.project.chapterCount);
  const isExpansion = chapter.status === "COMPLETED" && chapter.content.length < minimumWords;
  if (chapter.status === "COMPLETED" && !isExpansion) return apiError("CONFLICT", "本章已经达到最低字数", 409);
  const previous = await prisma.novelChapter.findMany({
    where: { projectId: id, number: { lt: number } },
    orderBy: { number: "asc" },
    select: { number: true, title: true, generationSummary: true, content: true, status: true },
  });
  if (previous.some((item) => item.status !== "COMPLETED")) return apiError("CONFLICT", "请先完成前面的章节", 409);

  await prisma.novelChapter.updateMany({
    where: { projectId: id, status: "GENERATING", updatedAt: { lt: new Date(Date.now() - 4 * 60_000) } },
    data: { status: "FAILED", errorCode: "STALE_GENERATION", errorMessage: "上次生成异常中断", completedAt: new Date() },
  });
  try {
    const locked = await prisma.novelChapter.updateMany({
      where: { id: chapter.id, status: { in: isExpansion ? ["PENDING", "FAILED", "CANCELLED", "COMPLETED"] : ["PENDING", "FAILED", "CANCELLED"] } },
      data: { status: "GENERATING", model, content: isExpansion ? chapter.content : "", errorCode: null, errorMessage: null },
    });
    if (!locked.count) return apiError("CONFLICT", "本章已完成或正在生成", 409);
    await prisma.novelProject.update({ where: { id }, data: { status: "GENERATING" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return apiError("GENERATION_BUSY", "这个项目已有一章正在生成", 409);
    throw error;
  }

  const context = { project: chapter.project, chapter, previous };
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort("timeout"), 180_000);
  const startedAt = Date.now();
  let content = isExpansion ? chapter.content : "";
  let finalTitle = chapter.title;
  let generationSummary = chapter.generationSummary;
  let usage: LlmUsage = {};
  let modelCalls = 0;
  const configuredMaxCalls = Number(process.env.LLM_CHAPTER_MAX_CALLS || 3);
  const maxCalls = Number.isInteger(configuredMaxCalls) && configuredMaxCalls >= 1 && configuredMaxCalls <= 5 ? configuredMaxCalls : 3;
  let finalized = false;
  let costPoints = new Prisma.Decimal(0);
  let clientCancelled = false;

  const finalize = async (status: "COMPLETED" | "FAILED" | "CANCELLED", code?: string, message?: string) => {
    if (finalized) return;
    finalized = true;
    clearTimeout(timeout);
    if ((usage.inputTokens || usage.outputTokens) && costPoints.eq(0)) {
      costPoints = await chargeUsage(session.user.id, selectedModel, usage, chapter.id, `生成《${chapter.project.title}》第 ${number} 章`);
    }
    await prisma.novelChapter.update({
      where: { id: chapter.id },
      data: {
        title: finalTitle,
        content,
        generationSummary: status === "COMPLETED" ? generationSummary : "",
        status,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        durationMs: Date.now() - startedAt,
        costPoints,
        errorCode: code,
        errorMessage: message,
        completedAt: new Date(),
      },
    });
    if (status === "COMPLETED") {
      const allChapters = await prisma.novelChapter.findMany({ where: { projectId: id }, select: { status: true, content: true } });
      const allComplete = allChapters.length === chapter.project.chapterCount
        && allChapters.every((item) => item.status === "COMPLETED" && item.content.length >= minimumWords);
      await prisma.novelProject.update({ where: { id }, data: { status: allComplete ? "COMPLETED" : "READY", completedAt: allComplete ? new Date() : null } });
    } else {
      await prisma.novelProject.update({ where: { id }, data: { status: "READY" } });
    }
  };

  const addUsage = (next: LlmUsage) => {
    usage = {
      inputTokens: (usage.inputTokens ?? 0) + (next.inputTokens ?? 0),
      outputTokens: (usage.outputTokens ?? 0) + (next.outputTokens ?? 0),
      totalTokens: (usage.totalTokens ?? 0) + (next.totalTokens ?? 0),
    };
  };

  const generateSegment = async (controller: ReadableStreamDefaultController<Uint8Array>, prompt: string) => {
    let segmentRaw = "";
    let emitted = 0;
    let bodyOffset = -1;
    for await (const item of streamStory(CHAPTER_SYSTEM, prompt, abort.signal, models)) {
      if (item.type === "model") { selectedModel = item.model; model = item.model.model; continue; }
      if (item.type === "usage") { addUsage(item.usage); continue; }
      segmentRaw += item.text;
      if (bodyOffset < 0) {
        const marker = segmentRaw.indexOf(BODY_MARKER);
        if (marker >= 0) bodyOffset = marker + BODY_MARKER.length;
      }
      if (bodyOffset >= 0) {
        const body = segmentRaw.slice(bodyOffset);
        const summaryAt = body.indexOf(SUMMARY_MARKER);
        const safeEnd = summaryAt >= 0 ? summaryAt : Math.max(0, body.length - SUMMARY_MARKER.length);
        if (safeEnd > emitted) {
          controller.enqueue(sse("delta", { text: body.slice(emitted, safeEnd) }));
          emitted = safeEnd;
        }
      }
    }
    const parsed = parseChapterOutput(segmentRaw, finalTitle, chapter.outlineSummary);
    if (!parsed.content.trim()) throw new Error("EMPTY_PROVIDER_OUTPUT");
    if (bodyOffset < 0) {
      controller.enqueue(sse("delta", { text: parsed.content }));
    } else {
      const body = segmentRaw.slice(bodyOffset);
      const summaryAt = body.indexOf(SUMMARY_MARKER);
      const bodyEnd = summaryAt >= 0 ? summaryAt : body.length;
      if (bodyEnd > emitted) controller.enqueue(sse("delta", { text: body.slice(emitted, bodyEnd).trimEnd() }));
    }
    return parsed;
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(sse("meta", { chapterId: chapter.id, number, minimumWords, targetWords: Math.round(chapter.project.targetWords / chapter.project.chapterCount), expanding: isExpansion }));
      if (isExpansion && content) controller.enqueue(sse("delta", { text: content }));
      try {
        while (content.length < minimumWords && modelCalls < maxCalls) {
          const prompt = content
            ? buildChapterContinuationPrompt(context, content)
            : buildChapterPrompt(context);
          const parsed = await generateSegment(controller, prompt);
          finalTitle = parsed.title || finalTitle;
          content = content ? `${content.trimEnd()}\n\n${parsed.content.trimStart()}` : parsed.content;
          generationSummary = parsed.summary;
          modelCalls += 1;
        }
        if (content.length < minimumWords) {
          const message = `本章生成 ${content.length} 字，未达到最低 ${minimumWords} 字，已保留内容，可继续补写`;
          await finalize("FAILED", "CHAPTER_TOO_SHORT", message);
          controller.enqueue(sse("error", { code: "CHAPTER_TOO_SHORT", message, actualWords: content.length, minimumWords, modelCalls }));
          return;
        }
        await finalize("COMPLETED");
        controller.enqueue(sse("done", { status: "COMPLETED", title: finalTitle, usage, actualWords: content.length, minimumWords, modelCalls }));
      } catch {
        const isTimeout = abort.signal.reason === "timeout";
        const isCancelled = clientCancelled || (abort.signal.aborted && !isTimeout);
        if (isCancelled) await finalize("CANCELLED", "CANCELLED", "用户已停止生成");
        else {
          const code = isTimeout ? "PROVIDER_TIMEOUT" : "PROVIDER_ERROR";
          const message = isTimeout ? "章节生成超时，可重试本章" : "章节生成失败，可重试本章";
          await finalize("FAILED", code, message);
          try { controller.enqueue(sse("error", { code, message })); } catch {}
        }
      } finally {
        try { controller.close(); } catch {}
      }
    },
    async cancel() {
      clientCancelled = true;
      abort.abort("client_cancelled");
      await finalize("CANCELLED", "CANCELLED", "用户已停止生成");
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
