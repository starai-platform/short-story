import { apiError } from "@/lib/api";
import { requireActiveApi } from "@/lib/auth-user";
import { isChapterComplete } from "@/lib/novels";
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
  const chapters = project.chapters.filter((chapter) => isChapterComplete(chapter, project.targetWords, project.chapterCount));
  const content = [`《${project.title}》`, "", project.synopsis, "", ...chapters.flatMap((chapter) => [`第${chapter.number}章 ${chapter.title}`, "", chapter.content, ""])] .join("\n");
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(project.title)}.txt`,
    },
  });
}
