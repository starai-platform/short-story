import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { assertCanGenerate, chargeUsage } from "@/lib/billing";
import { classifyProviderError, completeText, outlineMaxOutputTokens, resolveModelChain } from "@/lib/llm";
import { buildNovelOutlineResponseFormat, buildOutlinePrompt, normalizeKeywords, novelProjectInputSchema, OutlineOutputError, parseNovelOutline } from "@/lib/novels";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };
const OUTLINE_SYSTEM = "你是熟悉当前中文短篇网文读者留存规律的类型小说总编剧。大纲必须前后连贯、可逐章执行，尤其让前三章依次完成强钩子、兑现升级、首次大转折并锁定主线。严格输出 JSON，不展示分析。全书梗概 200–500 字，主要人物 3–6 人；每章 summary 50–100 字，beats 2–3 项且每项不超过 30 字。只写会实际发生的剧情动作、信息变化和选择，不写正文、氛围扩写或同义反复。";

export async function POST(_: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "请先登录", 401);
  const { id } = await params;
  const project = await prisma.novelProject.findFirst({ where: { id, userId: session.user.id } });
  if (!project) return apiError("NOT_FOUND", "小说项目不存在", 404);
  let models;
  try {
    models = await resolveModelChain();
    await assertCanGenerate(session.user.id, models[0]);
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_POINTS") return apiError("INSUFFICIENT_POINTS", "算力点不足，请先使用兑换码充值", 402);
    return apiError("PROVIDER_ERROR", "模型服务尚未正确配置", 503);
  }

  if (project.status === "OUTLINING" && project.updatedAt < new Date(Date.now() - 4 * 60_000)) {
    await prisma.novelProject.update({ where: { id }, data: { status: "FAILED", errorCode: "STALE_OUTLINE", errorMessage: "上次大纲生成异常中断" } });
  }
  const locked = await prisma.novelProject.updateMany({
    where: { id, userId: session.user.id, status: { in: ["DRAFT", "FAILED"] } },
    data: { status: "OUTLINING", errorCode: null, errorMessage: null },
  });
  if (!locked.count) return apiError("CONFLICT", "大纲已生成或正在生成", 409);

  const input = novelProjectInputSchema.parse({
    promptTypeId: project.promptTypeId ?? "snapshot",
    theme: project.theme,
    protagonist: project.protagonist,
    worldSetting: project.worldSetting,
    keywords: normalizeKeywords(project.keywords),
    style: project.style,
    pov: project.pov,
    pace: project.pace,
    ending: project.ending,
    constraints: project.constraints,
    chapterCount: project.chapterCount,
    targetWords: project.targetWords,
  });
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort("timeout"), 180_000);
  try {
    // Many OpenAI-compatible gateways do not implement json_schema even when
    // their chat endpoint otherwise works. Text mode plus local repair is the
    // safest default; deployments with verified support can opt into strict mode.
    const responseFormat = process.env.LLM_OUTLINE_RESPONSE_FORMAT?.trim().toLowerCase() === "json_schema"
      ? buildNovelOutlineResponseFormat(project.chapterCount)
      : undefined;
    const response = await completeText(
      OUTLINE_SYSTEM,
      buildOutlinePrompt(input, project.outlinePromptSnapshot),
      abort.signal,
      responseFormat,
      outlineMaxOutputTokens(project.chapterCount),
      models,
    );
    await chargeUsage(session.user.id, response.model, response.usage, project.id, `生成《${project.title}》大纲`);
    const parsed = parseNovelOutline(response.text, project.chapterCount);
    await prisma.$transaction(async (tx) => {
      await tx.novelChapter.deleteMany({ where: { projectId: id } });
      await tx.novelProject.update({
        where: { id },
        data: { title: parsed.title, synopsis: parsed.synopsis, characters: parsed.characters, outline: parsed, status: "READY" },
      });
      await tx.novelChapter.createMany({
        data: parsed.chapters.map((chapter) => ({
          projectId: id,
          number: chapter.number,
          title: chapter.title,
          outlineSummary: chapter.summary,
          beats: chapter.beats,
        })),
      });
    });
    return Response.json({ data: parsed });
  } catch (error) {
    if (error instanceof OutlineOutputError) {
      console.error("[outline-generation] invalid model output", { projectId: id, code: error.code, ...error.diagnostic });
      await prisma.novelProject.update({ where: { id }, data: { status: "FAILED", errorCode: error.code, errorMessage: error.message } });
      return apiError(error.code, `${error.message}，请重新生成`, 422, error.diagnostic);
    }

    const failure = classifyProviderError(error, abort.signal.reason === "timeout");
    console.error("[outline-generation] provider failure", { projectId: id, code: failure.code, ...failure.diagnostic });
    await prisma.novelProject.update({ where: { id }, data: { status: "FAILED", errorCode: failure.code, errorMessage: failure.message } });
    return apiError(failure.code, failure.message, failure.httpStatus);
  } finally {
    clearTimeout(timeout);
  }
}
