import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { promptTypeSchema, validateTemplate } from "@/lib/prompts";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "请先登录", 401);
  const { id } = await params;
  const prompt = await prisma.promptType.findFirst({
    where: { id, deletedAt: null, OR: [{ ownerId: null }, { ownerId: session.user.id }] },
  });
  if (!prompt) return apiError("NOT_FOUND", "模板不存在", 404);
  return Response.json({ data: prompt });
}

export async function PATCH(request: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "请先登录", 401);
  const { id } = await params;
  const existing = await prisma.promptType.findFirst({ where: { id, ownerId: session.user.id, deletedAt: null } });
  if (!existing) return apiError("NOT_FOUND", "模板不存在或不可编辑", 404);
  const parsed = promptTypeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "模板信息不正确", 400, parsed.error.flatten());
  const outlineCheck = validateTemplate(parsed.data.outlineTemplate);
  if (!outlineCheck.valid) return apiError("VALIDATION_ERROR", `大纲 Prompt 包含未知占位符：${outlineCheck.unknown.join("、")}`, 400);
  const chapterCheck = validateTemplate(parsed.data.chapterTemplate);
  if (!chapterCheck.valid) return apiError("VALIDATION_ERROR", `章节 Prompt 包含未知占位符：${chapterCheck.unknown.join("、")}`, 400);
  const prompt = await prisma.promptType.update({
    where: { id },
    data: { ...parsed.data, version: { increment: 1 } },
  });
  return Response.json({ data: prompt });
}

export async function DELETE(_: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "请先登录", 401);
  const { id } = await params;
  const result = await prisma.promptType.updateMany({
    where: { id, ownerId: session.user.id, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  });
  if (!result.count) return apiError("NOT_FOUND", "模板不存在或不可删除", 404);
  return new Response(null, { status: 204 });
}
