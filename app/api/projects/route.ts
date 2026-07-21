import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { novelProjectInputSchema } from "@/lib/novels";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "请先登录", 401);
  const projects = await prisma.novelProject.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { chapters: { select: { status: true } } },
  });
  return Response.json({ data: projects.map(({ chapters, ...project }) => ({
    ...project,
    completedChapters: chapters.filter((chapter) => chapter.status === "COMPLETED").length,
  })) });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "请先登录", 401);
  const parsed = novelProjectInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "小说参数不正确", 400, parsed.error.flatten());
  const prompt = await prisma.promptType.findFirst({
    where: { id: parsed.data.promptTypeId, deletedAt: null, isActive: true, OR: [{ ownerId: null }, { ownerId: session.user.id }] },
  });
  if (!prompt) return apiError("NOT_FOUND", "小说类型不存在或未启用", 404);
  const project = await prisma.novelProject.create({
    data: {
      userId: session.user.id,
      promptTypeId: prompt.id,
      promptNameSnapshot: prompt.name,
      outlinePromptSnapshot: prompt.outlineTemplate,
      chapterPromptSnapshot: prompt.chapterTemplate,
      promptVersionSnapshot: prompt.version,
      theme: parsed.data.theme,
      protagonist: parsed.data.protagonist,
      worldSetting: parsed.data.worldSetting,
      pace: parsed.data.pace,
      ending: parsed.data.ending,
      constraints: parsed.data.constraints,
      keywords: parsed.data.keywords,
      style: parsed.data.style,
      pov: parsed.data.pov,
      chapterCount: parsed.data.chapterCount,
      targetWords: parsed.data.targetWords,
    },
  });
  return Response.json({ data: project }, { status: 201 });
}
