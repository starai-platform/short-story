import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";
import { NovelReader } from "@/components/novel-reader";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ chapter?: string }> };
export default async function ReadPage({ params, searchParams }: Props) {
  const user = await requireUser(); const { id } = await params; const query = await searchParams;
  const project = await prisma.novelProject.findFirst({ where: { id, userId: user.id }, include: { chapters: { orderBy: { number: "asc" }, select: { number: true, title: true, content: true } } } });
  if (!project) notFound();
  if (project.status !== "COMPLETED" || project.chapters.some((chapter) => !chapter.content)) redirect(`/projects/${id}`);
  const initial = Math.min(project.chapterCount, Math.max(1, Number(query.chapter) || 1));
  return <NovelReader project={{ id: project.id, title: project.title }} chapters={project.chapters} initialChapter={initial}/>;
}
