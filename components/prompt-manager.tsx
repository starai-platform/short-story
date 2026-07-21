"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";

type Prompt = { id: string; ownerId: string | null; name: string; description: string; outlineTemplate: string; chapterTemplate: string; version: number; isActive: boolean };
type Draft = { name: string; description: string; outlineTemplate: string; chapterTemplate: string; isActive: boolean };
const empty: Draft = {
  name: "",
  description: "",
  outlineTemplate: `你是某类中文小说的策划编辑。请规定整部小说的主线结构、人物弧光、转折节奏、伏笔与结局要求。\n\n核心主题：{{theme}}\n主角设定：{{protagonist}}\n世界背景：{{worldSetting}}\n关键词：{{keywords}}\n语言风格：{{style}}\n叙事视角：{{pov}}\n节奏与结局：{{pace}}；{{ending}}\n额外限制：{{constraints}}\n全书目标篇幅：约 {{targetLength}} 个中文字\n\n只规划全书，不要写章节正文。`,
  chapterTemplate: `你是某类中文小说的正文作者。请规定场景、行动、对话、心理、节奏和语言表达要求，并确保各章连续。\n\n核心主题：{{theme}}\n主角设定：{{protagonist}}\n世界背景：{{worldSetting}}\n关键词：{{keywords}}\n语言风格：{{style}}\n叙事视角：{{pov}}\n节奏与结局：{{pace}}；{{ending}}\n额外限制：{{constraints}}\n本章目标篇幅：约 {{targetLength}} 个中文字\n\n严格服从既定大纲，只写本章正文。`,
  isActive: true,
};

export function PromptManager({ prompts }: { prompts: Prompt[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Prompt | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [systemQuery, setSystemQuery] = useState("");

  function open(prompt?: Prompt) {
    setError("");
    setEditing(prompt ?? "new");
    setDraft(prompt ? { name: prompt.name, description: prompt.description, outlineTemplate: prompt.outlineTemplate, chapterTemplate: prompt.chapterTemplate, isActive: prompt.isActive } : empty);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const isNew = editing === "new";
      const response = await fetch(isNew ? "/api/prompt-types" : `/api/prompt-types/${(editing as Prompt).id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error?.message || "保存失败"); }
      setEditing(null); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setLoading(false); }
  }

  async function action(prompt: Prompt, type: "copy" | "delete") {
    if (type === "delete" && !window.confirm(`确定删除“${prompt.name}”吗？历史记录不会受影响。`)) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(type === "copy" ? `/api/prompt-types/${prompt.id}/copy` : `/api/prompt-types/${prompt.id}`, { method: type === "copy" ? "POST" : "DELETE" });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error?.message || "操作失败"); }
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败"); }
    finally { setLoading(false); }
  }

  const system = prompts.filter((p) => !p.ownerId);
  const mine = prompts.filter((p) => p.ownerId);
  const filteredSystem = system.filter((prompt) => `${prompt.name} ${prompt.description}`.toLowerCase().includes(systemQuery.trim().toLowerCase()));
  return (
    <>
      {error && !editing && <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <section>
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-serif text-xl font-semibold">我的类型</h2><p className="mt-1 text-sm text-black/45">创建适合你题材和写法的专属模板。</p></div><button className="btn-primary" onClick={() => open()}><Plus className="size-4" />新建类型</button></div>
        {mine.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{mine.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} onEdit={() => open(prompt)} onCopy={() => action(prompt, "copy")} onDelete={() => action(prompt, "delete")} />)}</div>
          : <div className="card p-8 text-center text-sm text-black/45">还没有私有类型。可以新建，或复制下面的系统模板再修改。</div>}
      </section>
      <section className="mt-12">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h2 className="font-serif text-xl font-semibold">系统小说类型</h2><p className="mt-1 text-sm text-black/45">覆盖主流网文与传统类型，只读但可以复制后定制。</p></div><input className="field w-full md:w-72" value={systemQuery} onChange={(event) => setSystemQuery(event.target.value)} placeholder="搜索玄幻、言情、悬疑…" /></div>
        {filteredSystem.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredSystem.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} onCopy={() => action(prompt, "copy")} />)}</div> : <div className="card p-8 text-center text-sm text-black/45">没有匹配的小说类型。</div>}
      </section>

      {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
        <form onSubmit={save} className="card max-h-[92vh] w-full max-w-3xl overflow-y-auto bg-paper p-6 md:p-8">
          <div className="mb-6 flex items-start justify-between"><div><p className="eyebrow">Genre editor</p><h2 className="mt-2 font-serif text-2xl font-semibold">{editing === "new" ? "新建小说类型" : "编辑小说类型"}</h2></div><button type="button" className="rounded-lg p-2 hover:bg-black/5" onClick={() => setEditing(null)}><X className="size-5" /></button></div>
          <div className="space-y-5">
            <div><label className="label">名称</label><input className="field" required maxLength={60} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><label className="label">描述</label><textarea className="field min-h-20" maxLength={300} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            <div><div className="mb-2"><label className="label mb-0">大纲 Prompt</label><p className="mt-1 text-xs text-black/40">用于一次性规划全书结构、人物弧光与每章路线。</p><p className="mt-1 text-xs text-black/35">基础变量：{"{{theme}} {{keywords}} {{style}} {{pov}} {{targetLength}}"}<br />设定变量：{"{{protagonist}} {{worldSetting}} {{pace}} {{ending}} {{constraints}}"}</p></div><textarea className="field min-h-64 font-mono text-xs leading-6" required value={draft.outlineTemplate} onChange={(e) => setDraft({ ...draft, outlineTemplate: e.target.value })} /></div>
            <div><div className="mb-2"><label className="label mb-0">章节 Prompt</label><p className="mt-1 text-xs text-black/40">用于按章写正文；此处 targetLength 表示本章目标字数。</p><p className="mt-1 text-xs text-black/35">基础变量：{"{{theme}} {{keywords}} {{style}} {{pov}} {{targetLength}}"}<br />设定变量：{"{{protagonist}} {{worldSetting}} {{pace}} {{ending}} {{constraints}}"}</p></div><textarea className="field min-h-64 font-mono text-xs leading-6" required value={draft.chapterTemplate} onChange={(e) => setDraft({ ...draft, chapterTemplate: e.target.value })} /></div>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-ember" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />启用该类型</label>
            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>取消</button><button className="btn-primary" disabled={loading}>{loading && <LoaderCircle className="size-4 animate-spin" />}保存模板</button></div>
          </div>
        </form>
      </div>}
    </>
  );
}

function PromptCard({ prompt, onEdit, onCopy, onDelete }: { prompt: Prompt; onEdit?: () => void; onCopy: () => void; onDelete?: () => void }) {
  return <article className="card flex min-h-48 flex-col p-5"><div className="flex items-start justify-between gap-3"><div><span className={`rounded-full px-2 py-1 text-[11px] font-medium ${prompt.ownerId ? "bg-moss/10 text-moss" : "bg-ember/10 text-ember"}`}>{prompt.ownerId ? `我的 · v${prompt.version}` : "系统"}</span><h3 className="mt-3 font-serif text-lg font-semibold">{prompt.name}</h3></div>{prompt.ownerId && !prompt.isActive && <span className="text-xs text-black/35">已停用</span>}</div><p className="mt-2 line-clamp-3 text-sm leading-6 text-black/50">{prompt.description || "暂无描述"}</p><p className="mt-3 text-xs text-black/35">包含大纲 Prompt + 章节 Prompt</p><div className="mt-auto flex gap-2 pt-5">{onEdit && <button className="btn-secondary px-3" onClick={onEdit}><Pencil className="size-3.5" />编辑</button>}<button className="btn-secondary px-3" onClick={onCopy}><Copy className="size-3.5" />复制</button>{onDelete && <button className="ml-auto rounded-xl p-2.5 text-red-500 transition hover:bg-red-50" onClick={onDelete} title="删除"><Trash2 className="size-4" /></button>}</div></article>;
}
