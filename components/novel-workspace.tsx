"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookCheck, ChevronLeft, Download, LoaderCircle, Play, RotateCcw, Square, Trash2 } from "lucide-react";

type Chapter = { id: string; number: number; title: string; outlineSummary: string; beats: unknown; content: string; generationSummary: string; status: string; errorMessage: string | null };
type Project = { id: string; title: string; synopsis: string; theme: string; status: string; chapterCount: number; targetWords: number; style: string; pov: string; promptNameSnapshot: string; errorMessage: string | null };
const statusText: Record<string, string> = { PENDING: "待写", GENERATING: "生成中", COMPLETED: "完成", FAILED: "失败", CANCELLED: "已停止" };

export function NovelWorkspace({ project, initialChapters }: { project: Project; initialChapters: Chapter[] }) {
  const router = useRouter();
  const [chapters, setChapters] = useState(initialChapters);
  const [selectedNumber, setSelectedNumber] = useState(initialChapters.find((c) => c.status !== "COMPLETED")?.number ?? 1);
  const [streamText, setStreamText] = useState("");
  const [running, setRunning] = useState(false);
  const [batch, setBatch] = useState(false);
  const [outlining, setOutlining] = useState(false);
  const [error, setError] = useState(project.status === "FAILED" && !initialChapters.length ? project.errorMessage || "大纲生成失败，可以重新生成。" : "");
  const abortRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);
  const selected = chapters.find((chapter) => chapter.number === selectedNumber);
  const targetPerChapter = Math.round(project.targetWords / project.chapterCount);
  const minimumChapterWords = Math.max(2000, Math.floor(targetPerChapter * 0.85));
  const isChapterComplete = (chapter: Chapter) => chapter.status === "COMPLETED" && chapter.content.length >= minimumChapterWords;
  const completedCount = chapters.filter(isChapterComplete).length;
  const actualWords = chapters.reduce((sum, chapter) => sum + chapter.content.length, 0);
  const progress = project.chapterCount ? Math.round((completedCount / project.chapterCount) * 100) : 0;
  const nextNumber = useMemo(() => chapters.find((chapter) => !isChapterComplete(chapter))?.number, [chapters, minimumChapterWords]);
  const selectedNeedsWork = selected ? !isChapterComplete(selected) : false;

  async function generateOutline() {
    setOutlining(true); setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}/outline`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "大纲生成失败");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "大纲生成失败"); }
    finally { setOutlining(false); }
  }

  async function generateChapter(number: number) {
    setSelectedNumber(number); setStreamText(""); setError(""); setRunning(true);
    const controller = new AbortController(); abortRef.current = controller;
    let output = ""; let success = false; let finalTitle = "";
    setChapters((current) => current.map((chapter) => chapter.number === number ? { ...chapter, status: "GENERATING", content: "" } : chapter));
    try {
      const response = await fetch(`/api/projects/${project.id}/chapters/${number}/generate`, { method: "POST", signal: controller.signal, headers: { Accept: "text/event-stream" } });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error?.message || "章节生成失败"); }
      if (!response.body) throw new Error("浏览器不支持流式响应");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const blocks = buffer.split("\n\n"); buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const type = block.match(/^event:\s*(.+)$/m)?.[1]; const dataLine = block.match(/^data:\s*(.+)$/m)?.[1];
          if (!type || !dataLine) continue;
          const data = JSON.parse(dataLine);
          if (type === "delta") { output += data.text; setStreamText(output); }
          if (type === "done") { success = true; finalTitle = data.title || ""; }
          if (type === "error") throw new Error(data.message);
        }
        if (done) break;
      }
      if (!success) throw new Error("章节流意外中断，请重试");
      setChapters((current) => current.map((chapter) => chapter.number === number ? { ...chapter, title: finalTitle || chapter.title, content: output.trim(), status: "COMPLETED", errorMessage: null } : chapter));
      setStreamText("");
      return true;
    } catch (cause) {
      const stopped = controller.signal.aborted;
      setChapters((current) => current.map((chapter) => chapter.number === number ? { ...chapter, content: output, status: stopped ? "CANCELLED" : "FAILED", errorMessage: stopped ? "已停止，可从本章重试" : "生成失败，可重试" } : chapter));
      setError(stopped ? "已停止生成，之前完成的章节均已保存。" : cause instanceof Error ? cause.message : "章节生成失败");
      setStreamText("");
      return false;
    } finally { setRunning(false); abortRef.current = null; }
  }

  async function generateRemaining() {
    stopRequestedRef.current = false; setBatch(true); setError("");
    const remaining = chapters.filter((chapter) => !isChapterComplete(chapter)).map((chapter) => chapter.number);
    for (const number of remaining) {
      if (stopRequestedRef.current) break;
      const ok = await generateChapter(number);
      if (!ok) break;
    }
    setBatch(false); router.refresh();
  }

  function stopGeneration() {
    stopRequestedRef.current = true;
    abortRef.current?.abort();
    setBatch(false);
  }

  async function removeProject() {
    if (!window.confirm(`确定删除《${project.title}》及全部章节吗？此操作无法恢复。`)) return;
    const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (response.ok) { router.push("/projects"); router.refresh(); }
  }

  if (!chapters.length) return <div className="mx-auto max-w-4xl"><Link href="/projects" className="mb-7 inline-flex items-center gap-2 text-sm text-black/45"><ChevronLeft className="size-4" />返回书架</Link><div className="card p-8 text-center md:p-14"><RotateCcw className="mx-auto size-10 text-ember/60" /><h1 className="mt-5 font-serif text-3xl font-semibold">{project.title}</h1><p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-black/50">{project.theme}</p>{error && <p className="mx-auto mt-5 max-w-lg rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<button className="btn-primary mt-7" onClick={generateOutline} disabled={outlining}>{outlining ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}{outlining ? `正在规划 ${project.chapterCount} 章大纲…` : "重新生成全书大纲"}</button></div></div>;

  return <div className="mx-auto max-w-[1550px]"><Link href="/projects" className="mb-5 inline-flex items-center gap-2 text-sm text-black/45 hover:text-black"><ChevronLeft className="size-4" />返回书架</Link>
    <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow">{project.promptNameSnapshot} · {project.chapterCount} 章</p><h1 className="mt-2 font-serif text-3xl font-semibold md:text-4xl">{project.title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-black/50">{project.synopsis}</p></div><div className="flex flex-wrap gap-2">{running || batch ? <button className="btn-secondary border-red-200 text-red-600" onClick={stopGeneration}><Square className="size-4 fill-current" />停止</button> : <><button className="btn-primary" onClick={generateRemaining} disabled={!nextNumber}><Play className="size-4 fill-current" />{completedCount ? "续写/补足剩余章节" : chapters.some((chapter) => chapter.content.length > 0) ? "补足短章节" : "开始生成全书"}</button><a className="btn-secondary" href={`/api/projects/${project.id}/export`}><Download className="size-4" />导出 TXT</a><button className="btn-secondary border-red-200 px-3 text-red-600" onClick={removeProject}><Trash2 className="size-4" /></button></>}</div></header>
    <div className="card mb-6 p-4"><div className="flex flex-wrap items-center justify-between gap-3 text-sm"><div><b>{completedCount}/{project.chapterCount}</b><span className="ml-2 text-black/40">达标章节</span></div><div><b>{actualWords.toLocaleString()}</b><span className="ml-2 text-black/40">/ {project.targetWords.toLocaleString()} 目标字数</span></div><div><span className="text-black/40">每章最低 {minimumChapterWords.toLocaleString()} 字 · </span><span className="text-ember">{batch ? `连续生成中 · 第 ${selectedNumber} 章` : `${progress}%`}</span></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5"><div className="h-full rounded-full bg-ember transition-all" style={{ width: `${progress}%` }} /></div></div>
    {error && <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <div className="grid min-h-[720px] gap-5 lg:grid-cols-[320px_minmax(0,1fr)]"><aside className="card max-h-[780px] overflow-y-auto p-3"><div className="sticky top-0 z-10 bg-white/95 px-3 py-3 backdrop-blur"><p className="font-serif text-lg font-semibold">章节目录</p></div><div className="space-y-1">{chapters.map((chapter) => { const complete = isChapterComplete(chapter); const short = chapter.status === "COMPLETED" && !complete; return <button key={chapter.id} onClick={() => setSelectedNumber(chapter.number)} className={`w-full rounded-xl px-3 py-3 text-left transition ${selectedNumber === chapter.number ? "bg-ember/10" : "hover:bg-black/[.035]"}`}><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-medium">{chapter.number}. {chapter.title}</span><span className={`shrink-0 text-[11px] ${complete ? "text-moss" : short || chapter.status === "FAILED" ? "text-amber-600" : "text-black/35"}`}>{short ? "字数不足" : statusText[chapter.status]}</span></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-black/40">{chapter.outlineSummary}</p></button>; })}</div></aside>
      <section className="card overflow-hidden"><div className="flex min-h-16 items-center justify-between border-b border-black/10 px-6 py-3"><div><p className="font-serif text-xl font-semibold">第 {selected?.number} 章 · {selected?.title}</p><p className="mt-1 text-xs text-black/40">{selected && (isChapterComplete(selected) ? "完成" : selected.status === "COMPLETED" ? "字数不足" : statusText[selected.status])}{selected?.content ? ` · ${selected.content.length.toLocaleString()} / 最低 ${minimumChapterWords.toLocaleString()} 字` : ""}</p></div>{!running && selected && selectedNeedsWork && <button className="btn-primary" disabled={selected.number !== nextNumber} onClick={() => generateChapter(selected.number)}><Play className="size-4 fill-current" />{selected.content ? "继续扩写本章" : selected.status === "FAILED" || selected.status === "CANCELLED" ? "重试本章" : "生成本章"}</button>}</div><div className="p-6 md:p-10">{running && selected?.number === selectedNumber ? <article className="mx-auto max-w-3xl whitespace-pre-wrap font-serif text-[17px] leading-9">{streamText || <span className="flex items-center gap-2 font-sans text-sm text-ember"><LoaderCircle className="size-4 animate-spin" />正在构思本章开场…</span>}</article> : selected?.content ? <article className="mx-auto max-w-3xl whitespace-pre-wrap font-serif text-[17px] leading-9">{selected.content}</article> : <div className="mx-auto max-w-3xl"><p className="eyebrow">Chapter outline</p><h2 className="mt-3 font-serif text-2xl font-semibold">本章规划</h2><p className="mt-4 text-sm leading-7 text-black/55">{selected?.outlineSummary}</p><ul className="mt-5 space-y-2">{Array.isArray(selected?.beats) && selected.beats.map((beat, index) => <li key={index} className="rounded-xl bg-black/[.025] px-4 py-3 text-sm text-black/55">{index + 1}. {String(beat)}</li>)}</ul>{selected?.number !== nextNumber && <p className="mt-6 text-sm text-amber-700">需要先完成或补足前面的章节，才能生成本章。</p>}</div>}</div></section></div>
  </div>;
}
