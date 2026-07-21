"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookPlus, LoaderCircle } from "lucide-react";

type PromptOption = { id: string; name: string; description: string; ownerId: string | null };

export function NovelCreateForm({ prompts }: { prompts: PromptOption[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    promptTypeId: prompts[0]?.id ?? "",
    theme: "",
    protagonist: "",
    worldSetting: "",
    keywords: "",
    style: "细腻自然",
    pov: "第三人称限知",
    pace: "张弛有度",
    ending: "完整收束",
    constraints: "",
    chapterCount: 20,
    targetWords: 50000,
  });
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const perChapter = Math.round(form.targetWords / form.chapterCount);
  const selectedType = prompts.find((prompt) => prompt.id === form.promptTypeId);
  const systemTypes = prompts.filter((prompt) => !prompt.ownerId);
  const myTypes = prompts.filter((prompt) => prompt.ownerId);
  const wordRange = useMemo(() => ({ min: form.chapterCount * 2000, max: Math.min(100000, form.chapterCount * 5000) }), [form.chapterCount]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "chapterCount") {
        const count = Number(value);
        next.targetWords = Math.max(count * 2000, Math.min(next.targetWords, Math.min(100000, count * 5000)));
      }
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setPhase("正在创建小说项目…");
    let projectId = "";
    try {
      const created = await fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, keywords: form.keywords.split(/[，,、\n]/).map((item) => item.trim()).filter(Boolean) }),
      });
      const createdBody = await created.json();
      if (!created.ok) throw new Error(createdBody.error?.message || "创建失败");
      projectId = createdBody.data.id;
      setPhase(`正在规划 ${form.chapterCount} 章完整大纲…`);
      const outlined = await fetch(`/api/projects/${projectId}/outline`, { method: "POST" });
      if (!outlined.ok) {
        const body = await outlined.json();
        setError(`${body.error?.message || "大纲生成失败"}，已保存项目，可在项目内重试。`);
        setTimeout(() => router.push(`/projects/${projectId}`), 1200);
        return;
      }
      router.push(`/projects/${projectId}`); router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建失败");
      if (projectId) setTimeout(() => router.push(`/projects/${projectId}`), 1200);
    } finally { setLoading(false); setPhase(""); }
  }

  return <form onSubmit={submit} className="card mx-auto max-w-4xl p-6 md:p-9"><div className="grid gap-6 md:grid-cols-2">
    <div className="md:col-span-2"><label className="label">小说类型</label><select className="field" value={form.promptTypeId} onChange={(e) => set("promptTypeId", e.target.value)} required>{myTypes.length > 0 && <optgroup label="我的小说类型">{myTypes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}<optgroup label="系统小说类型">{systemTypes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup></select>{selectedType?.description && <p className="mt-2 text-xs leading-5 text-black/45">{selectedType.description}</p>}</div>
    <div className="md:col-span-2"><label className="label">核心创意与主要冲突</label><textarea className="field min-h-32" required minLength={10} maxLength={800} value={form.theme} onChange={(e) => set("theme", e.target.value)} placeholder="用几句话说明故事钩子、主角目标、主要阻力和核心冲突。不要在这里写完整大纲。" /><p className="mt-1 text-right text-xs text-black/35">{form.theme.length}/800</p></div>
    <div><label className="label">主角设定（可选）</label><textarea className="field min-h-28" maxLength={300} value={form.protagonist} onChange={(e) => set("protagonist", e.target.value)} placeholder="身份、性格、欲望、弱点或特殊能力。" /><p className="mt-1 text-right text-xs text-black/35">{form.protagonist.length}/300</p></div>
    <div><label className="label">世界背景（可选）</label><textarea className="field min-h-28" maxLength={400} value={form.worldSetting} onChange={(e) => set("worldSetting", e.target.value)} placeholder="时代、地点、社会规则、力量体系或关键限制。" /><p className="mt-1 text-right text-xs text-black/35">{form.worldSetting.length}/400</p></div>
    <div className="md:col-span-2"><label className="label">关键词</label><input className="field" value={form.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="成长、秘密、雨城、久别重逢（最多 10 个）" /></div>
    <div><label className="label">语言风格</label><select className="field" value={form.style} onChange={(e) => set("style", e.target.value)}><option>细腻自然</option><option>冷峻简洁</option><option>口语轻快</option><option>紧张快速</option><option>诗意克制</option><option>爽快直接</option><option>古典雅致</option><option>轻松幽默</option></select></div>
    <div><label className="label">叙事视角</label><select className="field" value={form.pov} onChange={(e) => set("pov", e.target.value)}><option>第三人称限知</option><option>第一人称</option><option>第三人称全知</option><option>双视角交替</option><option>多视角群像</option></select></div>
    <div><label className="label">叙事节奏</label><select className="field" value={form.pace} onChange={(e) => set("pace", e.target.value)}><option>张弛有度</option><option>快节奏强冲突</option><option>慢热沉浸</option><option>单线紧凑</option><option>多线交织</option></select></div>
    <div><label className="label">结局倾向</label><select className="field" value={form.ending} onChange={(e) => set("ending", e.target.value)}><option>完整收束</option><option>圆满结局</option><option>苦涩遗憾</option><option>开放余韵</option><option>终局反转</option><option>悲剧性结局</option></select></div>
    <div className="md:col-span-2"><label className="label">必须包含 / 避免内容（可选）</label><textarea className="field min-h-20" maxLength={300} value={form.constraints} onChange={(e) => set("constraints", e.target.value)} placeholder="例如：必须有双强对手戏；避免系统面板、失忆和强行误会。只写最重要的限制。" /><p className="mt-1 flex justify-between text-xs text-black/35"><span>限制在 300 字内，避免挤占模型正文上下文。</span><span>{form.constraints.length}/300</span></p></div>
    <div><div className="flex justify-between"><label className="label">章节数量</label><b className="text-ember">{form.chapterCount} 章</b></div><input className="w-full accent-ember" type="range" min={10} max={50} step={1} value={form.chapterCount} onChange={(e) => set("chapterCount", Number(e.target.value))} /><p className="mt-1 text-xs text-black/35">支持 10–50 章</p></div>
    <div><div className="flex justify-between"><label className="label">全书目标字数</label><b className="text-ember">{(form.targetWords / 10000).toFixed(1)} 万字</b></div><input className="w-full accent-ember" type="range" min={wordRange.min} max={wordRange.max} step={5000} value={form.targetWords} onChange={(e) => set("targetWords", Number(e.target.value))} /><p className="mt-1 text-xs text-black/35">每章目标约 {perChapter} 字 · 每章至少 2000 字 · 上限 10 万字</p></div>
  </div>{error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<div className="mt-8 flex items-center justify-between border-t border-black/10 pt-6"><p className="text-sm text-black/45">创建后先生成完整大纲，再按章写作并随时保存。</p><button className="btn-primary min-w-40" disabled={loading || !prompts.length}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <BookPlus className="size-4" />}{phase || "创建并规划大纲"}</button></div></form>;
}
