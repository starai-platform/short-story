import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { promptTypeSchema, validateTemplate } from "@/lib/prompts";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "请先登录", 401);
  const prompts = await prisma.promptType.findMany({
    where: {
      deletedAt: null,
      OR: [{ ownerId: null, isActive: true }, { ownerId: session.user.id }],
    },
    orderBy: [{ ownerId: "asc" }, { createdAt: "asc" }],
  });
  return Response.json({ data: prompts });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "请先登录", 401);
  const parsed = promptTypeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "模板信息不正确", 400, parsed.error.flatten());
  const outlineCheck = validateTemplate(parsed.data.outlineTemplate);
  if (!outlineCheck.valid) return apiError("VALIDATION_ERROR", `大纲 Prompt 包含未知占位符：${outlineCheck.unknown.join("、")}`, 400);
  const chapterCheck = validateTemplate(parsed.data.chapterTemplate);
  if (!chapterCheck.valid) return apiError("VALIDATION_ERROR", `章节 Prompt 包含未知占位符：${chapterCheck.unknown.join("、")}`, 400);
  const prompt = await prisma.promptType.create({ data: { ...parsed.data, ownerId: session.user.id } });
  return Response.json({ data: prompt }, { status: 201 });
}
