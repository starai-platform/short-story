"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const data = new FormData(event.currentTarget); const email = String(data.get("email") ?? ""); const password = String(data.get("password") ?? "");
    try {
      if (mode === "register") { const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }); if (!response.ok) { const body = await response.json(); throw new Error(body.error?.message || "注册失败"); } }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) throw new Error(mode === "login" ? "邮箱或密码不正确" : "登录失败");
      router.push("/projects"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败，请重试"); } finally { setLoading(false); }
  }
  const isLogin = mode === "login";
  return <div className="w-full max-w-[430px]">
    <div className="mb-10"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#ff5b35]">{isLogin ? "Welcome back" : "Create account"}</p><h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight">{isLogin ? "继续你的故事" : "创建写作空间"}</h1><p className="mt-3 text-sm leading-6 text-black/45">{isLogin ? "登录后继续管理作品、章节与创作进度。" : "注册一个私有空间，开始你的第一部完整小说。"}</p></div>
    <form onSubmit={submit} className="space-y-6"><label className="block"><span className="mb-2.5 block text-sm font-medium">邮箱地址</span><span className="relative block"><Mail className="absolute left-0 top-1/2 size-4 -translate-y-1/2 text-black/30" /><input className="w-full border-0 border-b border-black/15 bg-transparent py-3 pl-7 pr-2 text-sm outline-none transition placeholder:text-black/25 focus:border-[#ff5b35]" id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="name@example.com" /></span></label><label className="block"><span className="mb-2.5 block text-sm font-medium">登录密码</span><span className="relative block"><LockKeyhole className="absolute left-0 top-1/2 size-4 -translate-y-1/2 text-black/30" /><input className="w-full border-0 border-b border-black/15 bg-transparent py-3 pl-7 pr-10 text-sm outline-none transition placeholder:text-black/25 focus:border-[#ff5b35]" id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={isLogin ? "current-password" : "new-password"} required minLength={8} maxLength={72} placeholder="至少 8 位字符" /><button aria-label={showPassword ? "隐藏密码" : "显示密码"} type="button" className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-black/30 hover:text-black" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>{!isLogin && <p className="-mt-2 text-xs leading-5 text-black/35">密码长度为 8–72 位，建议组合使用字母、数字和符号。</p>}{error && <p role="alert" className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<button className="flex w-full items-center justify-center gap-2 bg-[#171717] px-5 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-black disabled:opacity-50" disabled={loading}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : null}{isLogin ? "登录工作台" : "注册并进入工作台"}<ArrowRight className="size-4" /></button></form>
    <div className="mt-8 flex items-center gap-4"><span className="h-px flex-1 bg-black/10" /><span className="text-[11px] uppercase tracking-widest text-black/25">OR</span><span className="h-px flex-1 bg-black/10" /></div><p className="mt-7 text-center text-sm text-black/45">{isLogin ? "还没有账号？" : "已有账号？"} <Link className="font-semibold text-black underline decoration-[#ff5b35] decoration-2 underline-offset-4" href={isLogin ? "/register" : "/login"}>{isLogin ? "立即注册" : "返回登录"}</Link></p>
  </div>;
}
