import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { requireUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";
import { formatDate, statusLabel } from "@/lib/format";

type Props = { searchParams: Promise<{ page?: string }> };

export default async function HistoryPage({ searchParams }: Props) {
  const user = await requireUser();
  const rawPage = Number((await searchParams).page ?? 1);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = 12;
  const [items, total] = await prisma.$transaction([
    prisma.generation.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.generation.count({ where: { userId: user.id } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="mx-auto max-w-7xl"><header className="mb-9"><p className="eyebrow">Archive</p><h1 className="mt-2 font-serif text-3xl font-semibold md:text-4xl">生成历史</h1><p className="mt-3 text-sm text-black/50">每次生成都保存输入、模板快照和模型信息。</p></header>
    {items.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => { const input = item.input as Record<string, unknown>; const title = item.output.split("\n").find(Boolean) || String(input.theme || "未命名故事"); return <Link href={`/history/${item.id}`} key={item.id} className="card group flex min-h-56 flex-col p-5 transition hover:-translate-y-0.5 hover:border-ember/30"><div className="flex items-center justify-between"><span className="rounded-full bg-black/5 px-2.5 py-1 text-xs text-black/55">{statusLabel(item.status)}</span><span className="text-xs text-black/35">{formatDate(item.createdAt)}</span></div><h2 className="mt-5 line-clamp-2 font-serif text-xl font-semibold group-hover:text-ember">{title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-black/45">{item.output.replace(title, "").trim() || String(input.theme || "尚无正文")}</p><div className="mt-auto flex items-center justify-between pt-5 text-xs text-black/35"><span>{item.promptNameSnapshot}</span><span>{Number(input.targetLength || 0)} 字目标</span></div></Link>; })}</div>
      : <div className="card flex min-h-80 flex-col items-center justify-center text-center"><FileText className="size-9 text-ember/50" /><p className="mt-4 font-serif text-xl">还没有生成记录</p><p className="mt-2 text-sm text-black/45">你的第一篇故事会出现在这里。</p><Link href="/generate" className="btn-primary mt-6">开始创作</Link></div>}
    {pages > 1 && <div className="mt-8 flex items-center justify-center gap-4"><Link aria-disabled={page <= 1} className={`btn-secondary ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={`/history?page=${page - 1}`}><ChevronLeft className="size-4" />上一页</Link><span className="text-sm text-black/45">{page} / {pages}</span><Link aria-disabled={page >= pages} className={`btn-secondary ${page >= pages ? "pointer-events-none opacity-40" : ""}`} href={`/history?page=${page + 1}`}>下一页<ChevronRight className="size-4" /></Link></div>}
  </div>;
}
