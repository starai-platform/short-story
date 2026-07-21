import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";
import { NovelWorkspace } from "@/components/novel-workspace";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const project = await prisma.novelProject.findFirst({ where: { id, userId: user.id }, include: { chapters: { orderBy: { number: "asc" } } } });
  if (!project) notFound();
  return <NovelWorkspace project={{ id: project.id, title: project.title, synopsis: project.synopsis, theme: project.theme, status: project.status, chapterCount: project.chapterCount, targetWords: project.targetWords, style: project.style, pov: project.pov, promptNameSnapshot: project.promptNameSnapshot, errorMessage: project.errorMessage }} initialChapters={project.chapters.map((chapter) => ({ id: chapter.id, number: chapter.number, title: chapter.title, outlineSummary: chapter.outlineSummary, beats: chapter.beats, content: chapter.content, generationSummary: chapter.generationSummary, status: chapter.status, errorMessage: chapter.errorMessage }))} />;
}
