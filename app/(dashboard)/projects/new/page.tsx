import { requireUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";
import { NovelCreateForm } from "@/components/novel-create-form";

export default async function NewProjectPage() {
  const user = await requireUser();
  const prompts = await prisma.promptType.findMany({ where: { deletedAt: null, isActive: true, OR: [{ ownerId: null }, { ownerId: user.id }] }, orderBy: [{ ownerId: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, description: true, ownerId: true } });
  return <div className="mx-auto max-w-6xl"><header className="mb-9 text-center"><p className="eyebrow">New novel</p><h1 className="mt-2 font-serif text-3xl font-semibold md:text-4xl">创建一部完整短篇小说</h1><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-black/50">规划 10–50 章、1.5–10 万字。先锁定全书结构，再逐章生成，避免长文本截断和剧情失控。</p></header><NovelCreateForm prompts={prompts} /></div>;
}
