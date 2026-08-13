import { apiError } from "@/lib/api";
import { requireActiveApi } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const authz = await requireActiveApi();
  if ("error" in authz) return authz.error;
  const { id } = await params;
  const generation = await prisma.generation.findFirst({ where: { id, userId: authz.user.id } });
  if (!generation) return apiError("NOT_FOUND", "生成记录不存在", 404);
  return Response.json({ data: generation });
}

export async function DELETE(_: Request, { params }: Context) {
  const authz = await requireActiveApi();
  if ("error" in authz) return authz.error;
  const { id } = await params;
  const result = await prisma.generation.deleteMany({ where: { id, userId: authz.user.id, status: { not: "RUNNING" } } });
  if (!result.count) return apiError("NOT_FOUND", "记录不存在或仍在生成", 404);
  return new Response(null, { status: 204 });
}
