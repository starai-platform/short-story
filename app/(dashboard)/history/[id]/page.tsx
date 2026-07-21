import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";
import { formatDate, statusLabel } from "@/lib/format";
import { HistoryActions } from "@/components/history-actions";

type Props = { params: Promise<{ id: string }> };

export default async function HistoryDetailPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const item = await prisma.generation.findFirst({ where: { id, userId: user.id } });
  if (!item) notFound();
  const input = item.input as Record<string, unknown>;
  const title = item.output.split("\n").find(Boolean) || String(input.theme || "未命名故事");
  return <div className="mx-auto max-w-5xl"><Link href="/history" className="mb-7 inline-flex items-center gap-2 text-sm text-black/45 hover:text-black"><ArrowLeft className="size-4" />返回历史</Link><div className="card overflow-hidden"><header className="border-b border-black/10 p-6 md:p-8"><div className="flex flex-wrap items-center gap-2 text-xs text-black/40"><span className="rounded-full bg-black/5 px-2.5 py-1 text-black/60">{statusLabel(item.status)}</span><span>{item.promptNameSnapshot} · v{item.promptVersionSnapshot}</span><span>·</span><span>{formatDate(item.createdAt)}</span></div><h1 className="mt-5 font-serif text-3xl font-semibold">{title}</h1><div className="mt-6"><HistoryActions id={item.id} output={item.output} title={title} /></div></header><div className="grid lg:grid-cols-[1fr_250px]"><article className="whitespace-pre-wrap p-6 font-serif text-[17px] leading-9 text-[#302925] md:p-10">{item.output || <span className="font-sans text-sm text-black/40">没有保存到正文。{item.errorMessage}</span>}</article><aside className="border-t border-black/10 bg-black/[.015] p-6 text-sm lg:border-l lg:border-t-0"><p className="font-medium">生成参数</p><dl className="mt-5 space-y-4 text-black/50"><div><dt className="text-xs text-black/35">主题</dt><dd className="mt-1 leading-6">{String(input.theme || "-")}</dd></div><div><dt className="text-xs text-black/35">关键词</dt><dd className="mt-1">{Array.isArray(input.keywords) ? input.keywords.join("、") || "-" : "-"}</dd></div><div><dt className="text-xs text-black/35">风格 / 视角</dt><dd className="mt-1">{String(input.style || "-")} · {String(input.pov || "-")}</dd></div><div><dt className="text-xs text-black/35">模型</dt><dd className="mt-1 break-all">{item.model}</dd></div><div><dt className="text-xs text-black/35">Token / 耗时</dt><dd className="mt-1">{item.totalTokens ?? "未返回"} · {item.durationMs ? `${(item.durationMs / 1000).toFixed(1)}s` : "-"}</dd></div></dl></aside></div></div></div>;
}
