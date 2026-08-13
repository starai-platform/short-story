import { apiError } from "@/lib/api";
import { requireActiveApi } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const authz = await requireActiveApi();
  if ("error" in authz) return authz.error;
  const { id } = await params;
  const project = await prisma.novelProject.findFirst({
    where: { id, userId: authz.user.id },
    include: { chapters: { orderBy: { number: "asc" } } },
  });
  if (!project) return apiError("NOT_FOUND", "小说项目不存在", 404);
  return Response.json({ data: project });
}

export async function DELETE(_: Request, { params }: Context) {
  const authz = await requireActiveApi();
  if ("error" in authz) return authz.error;
  const { id } = await params;
  const result = await prisma.novelProject.deleteMany({ where: { id, userId: authz.user.id, status: { notIn: ["OUTLINING", "GENERATING"] } } });
  if (!result.count) return apiError("NOT_FOUND", "项目不存在或正在生成", 404);
  return new Response(null, { status: 204 });
}
