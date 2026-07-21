"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Download, RefreshCw, Trash2 } from "lucide-react";

export function HistoryActions({ id, output, title }: { id: string; output: string; title: string }) {
  const router = useRouter();
  function download() {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${title.replace(/[\\/:*?\"<>|]/g, "_")}.txt`; link.click(); URL.revokeObjectURL(link.href);
  }
  async function remove() {
    if (!window.confirm("确定删除这条生成记录吗？此操作无法恢复。")) return;
    const response = await fetch(`/api/generations/${id}`, { method: "DELETE" });
    if (response.ok) { router.push("/history"); router.refresh(); }
  }
  return <div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => navigator.clipboard.writeText(output)}><Copy className="size-4" />复制</button><button className="btn-secondary" onClick={download}><Download className="size-4" />下载 TXT</button><Link className="btn-secondary" href={`/generate?from=${id}`}><RefreshCw className="size-4" />再次生成</Link><button className="btn-secondary border-red-200 text-red-600 hover:bg-red-50" onClick={remove}><Trash2 className="size-4" />删除</button></div>;
}
