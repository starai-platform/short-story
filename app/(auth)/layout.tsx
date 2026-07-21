import Link from "next/link";
import { BookOpenText, Check, Sparkles } from "lucide-react";
import { getSiteSettings } from "@/lib/site-settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return <main className="min-h-screen bg-[#f6f4ef] lg:grid lg:grid-cols-[minmax(420px,.92fr)_1.08fr]">
    <section className="relative hidden min-h-screen overflow-hidden bg-[#171717] px-10 py-9 text-white lg:flex lg:flex-col xl:px-16 xl:py-12">
      <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:56px_56px]" />
      <div className="absolute -right-32 top-1/3 size-96 rounded-full border border-white/10" /><div className="absolute -right-16 top-[42%] size-64 rounded-full border border-dashed border-white/10" />
      <Link href="/" className="relative flex items-center gap-3 font-serif text-xl font-semibold">{settings.logoUrl ? <img src={settings.logoUrl} alt={settings.siteName} className="size-10 rounded-xl object-contain" /> : <span className="grid size-10 place-items-center rounded-xl bg-white text-black"><BookOpenText className="size-5" /></span>}{settings.siteName}<span className="border-l border-white/15 pl-3 font-sans text-[10px] font-normal tracking-[.25em] text-white/35">AI NOVEL STUDIO</span></Link>
      <div className="relative my-auto max-w-xl"><span className="inline-flex items-center gap-2 border border-white/15 px-3 py-1.5 text-xs text-white/55"><Sparkles className="size-3.5 text-[#ff8062]" />长故事创作系统</span><h1 className="mt-8 font-serif text-5xl font-semibold leading-[1.08] tracking-tight xl:text-6xl">一个想法，<br /><span className="text-[#ff8062]">一部完整小说。</span></h1><p className="mt-7 max-w-md text-sm leading-7 text-white/45">从全书大纲到逐章正文，持续保持人物、伏笔与主线连贯，完成 10–50 章的中文小说。</p><div className="mt-9 grid gap-3 text-sm text-white/60 sm:grid-cols-2">{["完整大纲规划", "章节连续记忆", "多模型自动容错", "沉浸阅读体验"].map((item) => <span key={item} className="flex items-center gap-2"><Check className="size-3.5 text-[#ff8062]" />{item}</span>)}</div></div>
      <p className="relative border-t border-white/10 pt-5 text-xs text-white/25">{settings.footerCopyright}</p>
    </section>
    <section className="flex min-h-screen flex-col">
      <header className="flex h-20 items-center justify-between border-b border-black/10 px-5 lg:justify-end lg:px-10"><Link href="/" className="flex items-center gap-2.5 font-serif text-lg font-semibold lg:hidden">{settings.logoUrl ? <img src={settings.logoUrl} alt={settings.siteName} className="size-9 rounded-lg object-contain" /> : <span className="grid size-9 place-items-center rounded-lg bg-black text-white"><BookOpenText className="size-4" /></span>}{settings.siteName}</Link><Link href="/" className="text-sm text-black/45 transition hover:text-black">返回首页</Link></header>
      <div className="flex flex-1 items-center justify-center px-5 py-12 sm:px-10">{children}</div>
    </section>
  </main>;
}
