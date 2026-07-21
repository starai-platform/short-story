"use client";
import { useState } from "react";
import { CheckCircle2, Globe2, ImageUp, LoaderCircle, Save, Sparkles } from "lucide-react";

type Settings = { siteName: string; logoUrl: string; faviconUrl: string; siteTitle: string; siteDescription: string; footerCopyright: string };

export function SystemSettingsForm({ initialSettings }: { initialSettings: Settings }) {
  const [form, setForm] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);
  const [message, setMessage] = useState("");

  async function upload(file: File, kind: "logo" | "favicon") {
    setUploading(kind); setMessage("");
    const body = new FormData(); body.append("file", file); body.append("kind", kind);
    const response = await fetch("/api/admin/settings/upload", { method: "POST", body });
    const result = await response.json();
    if (response.ok) setForm((current) => ({ ...current, [kind === "logo" ? "logoUrl" : "faviconUrl"]: result.data.url }));
    else setMessage(result.error?.message || "上传失败");
    setUploading(null);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json();
    setMessage(response.ok ? "系统设置已保存，刷新页面后品牌信息将全部生效。" : result.error?.message || "保存失败");
    setSaving(false);
  }

  return <form onSubmit={save} className="grid gap-6 xl:grid-cols-[1fr_360px]">
    <div className="card divide-y divide-black/10 overflow-hidden">
      <section className="p-5 sm:p-7"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-orange-50 text-ember"><Sparkles className="size-5" /></span><div><h3 className="font-semibold">品牌标识</h3><p className="mt-1 text-xs text-black/40">用于首页、登录页和工作台导航。</p></div></div><div className="mt-6 grid gap-5 sm:grid-cols-2"><label><span className="label">站点名称</span><input className="field" required maxLength={40} value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} /></label><label><span className="label">LOGO 地址</span><input className="field" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="可填写 URL 或上传" /></label></div><label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium transition hover:border-black/25"><input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0], "logo")} />{uploading === "logo" ? <LoaderCircle className="size-4 animate-spin" /> : <ImageUp className="size-4" />}上传 LOGO <span className="text-xs font-normal text-black/35">PNG/JPG/WebP · 2MB 内</span></label></section>
      <section className="p-5 sm:p-7"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Globe2 className="size-5" /></span><div><h3 className="font-semibold">浏览器与搜索信息</h3><p className="mt-1 text-xs text-black/40">控制页面 Title、描述和浏览器标签图标。</p></div></div><div className="mt-6 space-y-5"><label><span className="label">页面 Title</span><input className="field" required maxLength={100} value={form.siteTitle} onChange={(e) => setForm({ ...form, siteTitle: e.target.value })} /></label><label><span className="label">站点描述</span><textarea className="field min-h-24 resize-y" required maxLength={300} value={form.siteDescription} onChange={(e) => setForm({ ...form, siteDescription: e.target.value })} /></label><label><span className="label">ICO / Favicon 地址</span><input className="field" value={form.faviconUrl} onChange={(e) => setForm({ ...form, faviconUrl: e.target.value })} placeholder="可填写 URL 或上传" /></label><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium transition hover:border-black/25"><input className="hidden" type="file" accept="image/png,image/x-icon,image/vnd.microsoft.icon" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0], "favicon")} />{uploading === "favicon" ? <LoaderCircle className="size-4 animate-spin" /> : <ImageUp className="size-4" />}上传 ICO <span className="text-xs font-normal text-black/35">PNG/ICO · 2MB 内</span></label></div></section>
      <section className="p-5 sm:p-7"><label><span className="label">首页底部版权</span><input className="field" required maxLength={200} value={form.footerCopyright} onChange={(e) => setForm({ ...form, footerCopyright: e.target.value })} /></label></section>
    </div>
    <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start"><div className="overflow-hidden rounded-3xl border border-black/10 bg-[#171717] p-6 text-white shadow-soft"><p className="text-xs uppercase tracking-[.2em] text-white/35">Brand preview</p><div className="mt-8 flex items-center gap-3">{form.logoUrl ? <img alt="LOGO 预览" src={form.logoUrl} className="size-12 rounded-xl object-contain" /> : <span className="grid size-12 place-items-center rounded-xl bg-white text-lg font-bold text-black">{form.siteName.slice(0, 1)}</span>}<div><p className="font-serif text-xl font-semibold">{form.siteName || "站点名称"}</p><p className="mt-1 text-xs text-white/35">AI NOVEL STUDIO</p></div></div><div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4"><p className="line-clamp-1 text-sm font-medium">{form.siteTitle}</p><p className="mt-2 line-clamp-3 text-xs leading-5 text-white/40">{form.siteDescription}</p></div><p className="mt-8 border-t border-white/10 pt-4 text-xs text-white/35">{form.footerCopyright}</p></div>{message && <p className={`rounded-2xl px-4 py-3 text-sm ${message.includes("已保存") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{message}</p>}<button className="btn-primary w-full py-3.5" disabled={saving || uploading !== null}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}保存系统设置</button><p className="flex items-start gap-2 px-2 text-xs leading-5 text-black/40"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />上传文件会保存到 Docker 持久化目录，重启后不会丢失。</p></aside>
  </form>;
}
