"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Copy, Download, LoaderCircle, Square, WandSparkles } from "lucide-react";

type PromptOption = { id: string; name: string; description: string; ownerId: string | null };
type FormState = { promptTypeId: string; theme: string; keywords: string; style: string; pov: string; targetLength: number };

const defaults: FormState = { promptTypeId: "", theme: "", keywords: "", style: "克制自然", pov: "第三人称限知", targetLength: 3000 };

export function Generator({ prompts, initial }: { prompts: PromptOption[]; initial?: Partial<FormState> }) {
  const initialState = { ...defaults, promptTypeId: prompts[0]?.id ?? "", ...initial };
  const [form, setForm] = useState<FormState>(initialState);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "stopped" | "error">("idle");
  const [error, setError] = useState("");
  const [generationId, setGenerationId] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const selected = useMemo(() => prompts.find((prompt) => prompt.id === form.promptTypeId), [form.promptTypeId, prompts]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setOutput("");
    setError("");
    setGenerationId("");
    setStatus("running");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/generations/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          ...form,
          keywords: form.keywords.split(/[，,、\n]/).map((item) => item.trim()).filter(Boolean),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || "生成请求失败");
      }
      if (!response.body) throw new Error("浏览器不支持流式响应");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const eventName = block.match(/^event:\s*(.+)$/m)?.[1];
          const dataLine = block.match(/^data:\s*(.+)$/m)?.[1];
          if (!eventName || !dataLine) continue;
          const data = JSON.parse(dataLine);
          if (eventName === "meta") setGenerationId(data.generationId);
          if (eventName === "delta") setOutput((current) => current + data.text);
          if (eventName === "done") { completed = true; setStatus("done"); }
          if (eventName === "error") { setError(data.message); setStatus("error"); }
        }
        if (done) break;
      }
      if (!completed && !controller.signal.aborted && status !== "error") setStatus("error");
    } catch (cause) {
      if (controller.signal.aborted) {
        setStatus("stopped");
      } else {
        setError(cause instanceof Error ? cause.message : "生成失败，请稍后重试");
        setStatus("error");
      }
    } finally {
      abortRef.current = null;
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
  }

  function download() {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${output.split("\n")[0]?.replace(/[\\/:*?\"<>|]/g, "_") || "短篇小说"}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
      <form onSubmit={generate} className="card h-fit p-5 md:p-6">
        <div className="mb-6">
          <p className="eyebrow">Story brief</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold">故事设定</h2>
        </div>
        <div className="space-y-5">
          <div>
            <label className="label">小说类型</label>
            <select className="field" value={form.promptTypeId} onChange={(event) => update("promptTypeId", event.target.value)} required>
              {prompts.map((prompt) => <option key={prompt.id} value={prompt.id}>{prompt.name}{prompt.ownerId ? " · 我的" : " · 系统"}</option>)}
            </select>
            {selected && <p className="mt-2 text-xs leading-5 text-black/45">{selected.description}</p>}
          </div>
          <div>
            <label className="label">故事主题 <span className="text-ember">*</span></label>
            <textarea className="field min-h-24 resize-y" value={form.theme} onChange={(event) => update("theme", event.target.value)} maxLength={200} required placeholder="例如：一个只在雨夜营业的旧书店，店主能替顾客保存一段记忆。" />
            <p className="mt-1 text-right text-xs text-black/35">{form.theme.length}/200</p>
          </div>
          <div>
            <label className="label">关键词</label>
            <input className="field" value={form.keywords} onChange={(event) => update("keywords", event.target.value)} placeholder="雨夜、旧书、失忆（最多 10 个）" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">语言风格</label>
              <select className="field" value={form.style} onChange={(event) => update("style", event.target.value)}>
                <option>克制自然</option><option>口语轻快</option><option>冷峻简洁</option><option>细腻诗意</option><option>紧张快速</option>
              </select>
            </div>
            <div>
              <label className="label">叙事视角</label>
              <select className="field" value={form.pov} onChange={(event) => update("pov", event.target.value)}>
                <option>第三人称限知</option><option>第一人称</option><option>第三人称全知</option>
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between"><label className="label">目标字数</label><span className="text-sm font-medium text-ember">{form.targetLength} 字</span></div>
            <input className="w-full accent-ember" type="range" min={1000} max={6000} step={500} value={form.targetLength} onChange={(event) => update("targetLength", Number(event.target.value))} />
          </div>
          {prompts.length ? (
            status === "running" ? <button type="button" className="btn-secondary w-full border-red-200 text-red-700" onClick={() => abortRef.current?.abort()}><Square className="size-4 fill-current" />停止生成</button>
              : <button className="btn-primary w-full" disabled={!form.theme.trim()}><WandSparkles className="size-4" />生成完整小说</button>
          ) : <Link href="/prompts" className="btn-primary w-full">先创建小说类型</Link>}
        </div>
      </form>

      <section className="card flex min-h-[620px] flex-col overflow-hidden">
        <div className="flex min-h-16 items-center justify-between border-b border-black/10 px-5 py-3 md:px-7">
          <div>
            <p className="text-sm font-medium">小说正文</p>
            <p className="mt-0.5 text-xs text-black/40">{status === "running" ? "正在创作，请保持页面打开" : status === "done" ? "已完成并保存" : status === "stopped" ? "已停止，部分内容已保存" : "生成结果会实时出现在这里"}</p>
          </div>
          {output && <div className="flex gap-2"><button className="btn-secondary px-3" onClick={copy} title="复制"><Copy className="size-4" /></button><button className="btn-secondary px-3" onClick={download} title="下载 TXT"><Download className="size-4" /></button></div>}
        </div>
        <div className="flex-1 p-6 md:p-10">
          {error && <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {output ? <article className="mx-auto max-w-3xl whitespace-pre-wrap font-serif text-[17px] leading-9 text-[#302925]">{output}</article>
            : <div className="flex h-full min-h-[430px] flex-col items-center justify-center text-center text-black/30"><div className="mb-4 rounded-full bg-ember/10 p-4"><WandSparkles className="size-7 text-ember" /></div><p className="font-serif text-lg text-black/50">故事还没有落笔</p><p className="mt-2 max-w-xs text-sm leading-6">在左侧选择类型并写下主题，一次生成完整短篇。</p></div>}
          {status === "running" && <div className="mx-auto mt-8 flex max-w-3xl items-center gap-2 text-sm text-ember"><LoaderCircle className="size-4 animate-spin" />模型正在续写…</div>}
          {generationId && status !== "running" && <div className="mx-auto mt-8 max-w-3xl text-right"><Link href={`/history/${generationId}`} className="text-sm text-ember hover:underline">查看生成记录 →</Link></div>}
        </div>
      </section>
    </div>
  );
}
