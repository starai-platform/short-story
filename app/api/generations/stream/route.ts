import { Prisma } from "@prisma/client";
import { apiError } from "@/lib/api";
import { requireActiveApi } from "@/lib/auth-user";
import { assertCanGenerate, billingErrorResponse, chargeUsage } from "@/lib/billing";
import { classifyProviderError, resolveModelChain, streamStory, type LlmUsage, type ResolvedModel } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import { generationInputSchema, renderPrompt, STORY_SYSTEM_PROMPT } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 200;

const encoder = new TextEncoder();

function event(type: string, data: unknown) {
  return encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: Request) {
  const authz = await requireActiveApi();
  if ("error" in authz) return authz.error;

  const parsed = generationInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "生成参数不正确", 400, parsed.error.flatten());

  let models: ResolvedModel[];
  try {
    models = await resolveModelChain();
    await assertCanGenerate(authz.user.id, ...models);
  } catch (error) {
    return billingErrorResponse(error);
  }
  let selectedModel = models[0];
  let model = selectedModel.model;

  const prompt = await prisma.promptType.findFirst({
    where: {
      id: parsed.data.promptTypeId,
      deletedAt: null,
      isActive: true,
      OR: [{ ownerId: null }, { ownerId: authz.user.id }],
    },
  });
  if (!prompt) return apiError("NOT_FOUND", "小说类型不存在或未启用", 404);

  let generation;
  try {
    await prisma.generation.updateMany({
      where: { userId: authz.user.id, status: "RUNNING", createdAt: { lt: new Date(Date.now() - 4 * 60_000) } },
      data: {
        status: "FAILED",
        errorCode: "STALE_GENERATION",
        errorMessage: "上次生成异常中断",
        completedAt: new Date(),
      },
    });
    generation = await prisma.generation.create({
      data: {
        userId: authz.user.id,
        promptTypeId: prompt.id,
        promptNameSnapshot: prompt.name,
        promptTemplateSnapshot: prompt.chapterTemplate,
        promptVersionSnapshot: prompt.version,
        input: parsed.data,
        model,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError("GENERATION_BUSY", "你已有一个正在生成的任务", 409);
    }
    throw error;
  }

  const userPrompt = renderPrompt(prompt.chapterTemplate, parsed.data);
  const startedAt = Date.now();
  const upstreamAbort = new AbortController();
  let output = "";
  let usage: LlmUsage = {};
  let finalized = false;
  let clientCancelled = false;
  const timeout = setTimeout(() => upstreamAbort.abort("timeout"), 180_000);

  const finalize = async (
    status: "COMPLETED" | "FAILED" | "CANCELLED",
    errorCode?: string,
    errorMessage?: string,
  ) => {
    if (finalized) return;
    finalized = true;
    clearTimeout(timeout);
    const costPoints = await chargeUsage(authz.user.id, selectedModel, usage, generation.id, "单篇小说生成").catch((error) => {
      if (error instanceof Error && (error.message === "INSUFFICIENT_POINTS" || error.message === "ACCOUNT_DISABLED")) {
        console.error("[generation-stream] billing failed after generation", { generationId: generation.id, code: error.message });
        return new Prisma.Decimal(0);
      }
      throw error;
    });
    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status,
        model,
        output,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        durationMs: Date.now() - startedAt,
        costPoints,
        completedAt: new Date(),
        errorCode,
        errorMessage,
      },
    });
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(event("meta", { generationId: generation.id }));
      try {
        for await (const item of streamStory(STORY_SYSTEM_PROMPT, userPrompt, upstreamAbort.signal, models)) {
          if (item.type === "model") { selectedModel = item.model; model = item.model.model; continue; }
          if (item.type === "delta") {
            output += item.text;
            controller.enqueue(event("delta", { text: item.text }));
          } else {
            usage = {
              inputTokens: (usage.inputTokens ?? 0) + (item.usage.inputTokens ?? 0),
              outputTokens: (usage.outputTokens ?? 0) + (item.usage.outputTokens ?? 0),
              totalTokens: (usage.totalTokens ?? 0) + (item.usage.totalTokens ?? 0),
            };
          }
        }
        if (!output.trim()) throw new Error("EMPTY_PROVIDER_OUTPUT");
        await finalize("COMPLETED");
        controller.enqueue(event("done", { status: "COMPLETED", usage, durationMs: Date.now() - startedAt }));
      } catch (error) {
        const isTimeout = upstreamAbort.signal.reason === "timeout";
        const isCancelled = clientCancelled || (upstreamAbort.signal.aborted && !isTimeout);
        if (isCancelled) {
          await finalize("CANCELLED", "CANCELLED", "用户已停止生成");
        } else {
          const failure = classifyProviderError(error, isTimeout);
          console.error("[generation-stream] failed", { generationId: generation.id, code: failure.code });
          await finalize("FAILED", failure.code, failure.message);
          try {
            controller.enqueue(event("error", { code: failure.code, message: failure.message }));
          } catch {}
        }
      } finally {
        clearTimeout(timeout);
        try {
          controller.close();
        } catch {}
      }
    },
    async cancel() {
      clientCancelled = true;
      upstreamAbort.abort("client_cancelled");
      await finalize("CANCELLED", "CANCELLED", "用户已停止生成");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
