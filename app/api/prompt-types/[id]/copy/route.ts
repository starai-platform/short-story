import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "请先登录", 401);
  const { id } = await params;
  const source = await prisma.promptType.findFirst({
    where: { id, deletedAt: null, OR: [{ ownerId: null, isActive: true }, { ownerId: session.user.id }] },
  });
  if (!source) return apiError("NOT_FOUND", "模板不存在", 404);
  const copy = await prisma.promptType.create({
    data: {
      ownerId: session.user.id,
      name: `${source.name}（副本）`.slice(0, 60),
      description: source.description,
      outlineTemplate: source.outlineTemplate,
      chapterTemplate: source.chapterTemplate,
      isActive: true,
    },
  });
  return Response.json({ data: copy }, { status: 201 });
}
