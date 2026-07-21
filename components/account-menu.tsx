"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "next-auth/react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  KeyRound,
  LoaderCircle,
  LogOut,
  ReceiptText,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

type Modal = "account" | "recharge" | "password" | null;
type Transaction = { id: string; type: string; amount: string; balanceAfter: string; description: string; createdAt: string };
type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

const typeNames: Record<string, string> = { RECHARGE: "兑换充值", CONSUMPTION: "模型消耗", ADJUSTMENT: "后台调整", REFUND: "费用退回" };

export function AccountMenu({ email, initialPoints, isAdmin }: { email: string; initialPoints: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [points, setPoints] = useState(Number(initialPoints));
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const loadTransactions = useCallback(async (page = 1) => {
    setLedgerLoading(true);
    try {
      const response = await fetch(`/api/account?page=${page}`);
      const body = await response.json();
      if (response.ok) {
        setTransactions(body.data.pointTransactions);
        setPagination(body.data.pagination);
        setPoints(Number(body.data.points));
      }
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  useEffect(() => {
    const show = () => setModal("recharge");
    window.addEventListener("open-recharge", show);
    return () => window.removeEventListener("open-recharge", show);
  }, []);
  useEffect(() => { if (modal === "recharge") void loadTransactions(1); }, [modal, loadTransactions]);

  function closeModal() { setModal(null); setMessage(""); }
  async function redeem() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/account/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const body = await response.json();
    if (response.ok) {
      setPoints(Number(body.data.balance)); setCode(""); setMessage(`充值成功，到账 ${body.data.points} 算力点`);
      await loadTransactions(1);
    } else setMessage(body.error?.message || "兑换失败");
    setBusy(false);
  }
  async function changePassword() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(passwords) });
    const body = await response.json();
    setMessage(response.ok ? "密码修改成功" : body.error?.message || "修改失败");
    if (response.ok) setPasswords({ currentPassword: "", newPassword: "" });
    setBusy(false);
  }

  return <div className="relative">
    <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full border border-black/10 bg-white py-1.5 pl-1.5 pr-3 shadow-sm transition hover:border-black/20">
      <span className="grid size-8 place-items-center rounded-full bg-ink text-white"><UserRound className="size-4" /></span>
      <span className="hidden max-w-40 truncate text-sm sm:block">{email}</span>
      <span className="hidden items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700 lg:flex"><Coins className="size-3" />{points.toFixed(3)}</span>
      <ChevronDown className="size-3.5 text-black/40" />
    </button>
    {open && <>
      <button aria-label="关闭菜单" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
      <div className="absolute right-0 z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-black/10 bg-white p-2 shadow-2xl">
        <div className="border-b border-black/10 px-3 py-3"><p className="truncate text-sm font-medium">{email}</p><p className="mt-1 flex items-center gap-1 text-xs text-black/45">{isAdmin && <><ShieldCheck className="size-3 text-ember" />管理员 · </>}余额 {points.toFixed(6)} 算力点</p></div>
        <button className="menu-item" onClick={() => { setModal("account"); setOpen(false); }}><UserRound className="size-4" />账户信息</button>
        <button className="menu-item" onClick={() => { setModal("recharge"); setOpen(false); }}><WalletCards className="size-4" />兑换码充值</button>
        <button className="menu-item" onClick={() => { setModal("password"); setOpen(false); }}><KeyRound className="size-4" />修改密码</button>
        <button className="menu-item text-red-600" onClick={() => signOut({ callbackUrl: "/login" })}><LogOut className="size-4" />退出登录</button>
      </div>
    </>}
    {modal && createPortal(<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      <button aria-label="关闭弹窗" className="absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={closeModal} />
      <section role="dialog" aria-modal="true" className={`relative max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-3xl border border-white/60 bg-white p-5 shadow-[0_30px_100px_rgba(32,27,24,.28)] sm:p-7 ${modal === "recharge" ? "max-w-3xl" : "max-w-md"}`}>
        <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Account center</p><h2 className="mt-2 font-serif text-2xl font-semibold">{modal === "recharge" ? "充值算力点" : modal === "password" ? "修改密码" : "账户信息"}</h2></div><button aria-label="关闭" className="rounded-full border border-black/10 p-2 hover:bg-black/5" onClick={closeModal}><X className="size-5" /></button></div>
        {modal === "account" && <div className="mt-6 space-y-3"><div className="rounded-2xl bg-paper p-4"><p className="text-xs text-black/40">登录邮箱</p><p className="mt-1 break-all font-medium">{email}</p></div><div className="rounded-2xl border border-amber-200/70 bg-amber-50 p-4"><p className="text-xs text-amber-700/60">可用算力点</p><p className="mt-1 text-2xl font-semibold text-amber-800">{points.toFixed(6)}</p><p className="mt-1 text-xs text-amber-700/70">1 元 = 1 算力点，按实际 Token 与模型费率扣除</p></div></div>}
        {modal === "recharge" && <div className="mt-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><input className="field uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="请输入兑换码" /><button className="btn-primary min-w-32" disabled={busy || code.trim().length < 4} onClick={redeem}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <WalletCards className="size-4" />}确认兑换</button></div>
          <div className="mt-7 border-t border-black/10 pt-6"><div className="flex items-end justify-between gap-3"><div><h3 className="flex items-center gap-2 font-semibold"><ReceiptText className="size-4 text-ember" />兑换与消耗流水</h3><p className="mt-1 text-xs text-black/40">每页显示 10 条，共 {pagination.total} 条记录</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">余额 {points.toFixed(3)}</span></div>
            <div className="mt-4 min-h-56 overflow-hidden rounded-2xl border border-black/10">
              {ledgerLoading ? <div className="grid h-56 place-items-center text-sm text-black/40"><LoaderCircle className="size-5 animate-spin" /></div> : transactions.length === 0 ? <div className="grid h-56 place-items-center text-sm text-black/40">暂无兑换或消耗记录</div> : <div className="divide-y divide-black/5">{transactions.map((item) => { const amount = Number(item.amount); return <div key={item.id} className="flex items-center gap-3 px-4 py-3.5"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${amount >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"}`}>{amount >= 0 ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-medium">{typeNames[item.type] || item.description}</p><b className={`shrink-0 text-sm ${amount >= 0 ? "text-emerald-600" : "text-orange-600"}`}>{amount >= 0 ? "+" : ""}{amount.toFixed(6)}</b></div><div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-black/40"><span className="truncate">{item.description}</span><span className="shrink-0">{new Date(item.createdAt).toLocaleString("zh-CN")}</span></div></div></div>; })}</div>}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2"><button className="btn-secondary px-3 py-2" disabled={pagination.page <= 1 || ledgerLoading} onClick={() => loadTransactions(pagination.page - 1)}><ChevronLeft className="size-4" /></button><span className="min-w-20 text-center text-xs text-black/50">{pagination.page} / {pagination.totalPages}</span><button className="btn-secondary px-3 py-2" disabled={pagination.page >= pagination.totalPages || ledgerLoading} onClick={() => loadTransactions(pagination.page + 1)}><ChevronRight className="size-4" /></button></div>
          </div>
        </div>}
        {modal === "password" && <div className="mt-6 space-y-3"><input className="field" type="password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} placeholder="当前密码" /><input className="field" type="password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} placeholder="新密码（8–72 位）" /><button className="btn-primary w-full" disabled={busy} onClick={changePassword}>{busy && <LoaderCircle className="size-4 animate-spin" />}保存新密码</button></div>}
        {message && <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${message.includes("成功") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message}</p>}
      </section>
    </div>, document.body)}
  </div>;
}
