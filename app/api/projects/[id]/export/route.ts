import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "请先登录", 401);
  const { id } = await params;
  const project = await prisma.novelProject.findFirst({
    where: { id, userId: session.user.id },
    include: { chapters: { where: { status: "COMPLETED" }, orderBy: { number: "asc" } } },
  });
  if (!project) return apiError("NOT_FOUND", "小说项目不存在", 404);
  const content = [`《${project.title}》`, "", project.synopsis, "", ...project.chapters.flatMap((chapter) => [`第${chapter.number}章 ${chapter.title}`, "", chapter.content, ""])] .join("\n");
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(project.title)}.txt`,
    },
  });
}
