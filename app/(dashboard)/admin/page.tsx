import { Activity, Bot, Coins, Cpu, Library, ReceiptText, TicketPercent, TrendingDown, Users, Zap } from "lucide-react";
import { prisma } from "@/lib/prisma";

function compact(value: number) { return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 2 }).format(value); }

export default async function AdminPage() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [users, projects, models, codes, balances, chapterUsage, generationUsage, consumed, todayConsumed, recharge, consumingUsers, recent] = await Promise.all([
    prisma.user.count(),
    prisma.novelProject.count(),
    prisma.aiModel.count({ where: { isActive: true } }),
    prisma.redemptionCode.count({ where: { isActive: true } }),
    prisma.user.aggregate({ _sum: { points: true } }),
    prisma.novelChapter.aggregate({ _sum: { inputTokens: true, outputTokens: true, totalTokens: true, costPoints: true } }),
    prisma.generation.aggregate({ _sum: { inputTokens: true, outputTokens: true, totalTokens: true, costPoints: true } }),
    prisma.pointTransaction.aggregate({ where: { type: "CONSUMPTION" }, _sum: { amount: true } }),
    prisma.pointTransaction.aggregate({ where: { type: "CONSUMPTION", createdAt: { gte: today } }, _sum: { amount: true } }),
    prisma.pointTransaction.aggregate({ where: { type: "RECHARGE" }, _sum: { amount: true } }),
    prisma.pointTransaction.groupBy({ by: ["userId"], where: { type: "CONSUMPTION" } }),
    prisma.pointTransaction.findMany({ where: { type: "CONSUMPTION" }, orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { email: true } } } }),
  ]);
  const inputTokens = Number(chapterUsage._sum.inputTokens || 0) + Number(generationUsage._sum.inputTokens || 0);
  const outputTokens = Number(chapterUsage._sum.outputTokens || 0) + Number(generationUsage._sum.outputTokens || 0);
  const totalTokens = Number(chapterUsage._sum.totalTokens || 0) + Number(generationUsage._sum.totalTokens || 0);
  const modelCost = Number(chapterUsage._sum.costPoints || 0) + Number(generationUsage._sum.costPoints || 0);
  const userConsumed = Math.abs(Number(consumed._sum.amount || 0));
  const todayUsage = Math.abs(Number(todayConsumed._sum.amount || 0));
  const cards = [
    { label: "注册用户", value: users, note: `${consumingUsers.length} 位产生过消耗`, icon: Users, tone: "bg-blue-50 text-blue-600" },
    { label: "小说项目", value: projects, note: "全部创作项目", icon: Library, tone: "bg-violet-50 text-violet-600" },
    { label: "启用模型", value: models, note: "默认与备用模型", icon: Bot, tone: "bg-cyan-50 text-cyan-600" },
    { label: "有效兑换码", value: codes, note: `累计充值 ${Number(recharge._sum.amount || 0).toFixed(3)} 点`, icon: TicketPercent, tone: "bg-emerald-50 text-emerald-600" },
    { label: "用户余额", value: Number(balances._sum.points || 0).toFixed(3), note: "当前未消耗算力点", icon: Coins, tone: "bg-amber-50 text-amber-600" },
    { label: "真实 Token 用量", value: compact(totalTokens), note: `输入 ${compact(inputTokens)} · 输出 ${compact(outputTokens)}`, icon: Cpu, tone: "bg-slate-100 text-slate-700" },
    { label: "模型计费成本", value: modelCost.toFixed(6), note: "已落库生成成本", icon: Zap, tone: "bg-orange-50 text-orange-600" },
    { label: "用户累计消耗", value: userConsumed.toFixed(6), note: "按费率倍率后的扣点", icon: TrendingDown, tone: "bg-rose-50 text-rose-600" },
    { label: "今日用户消耗", value: todayUsage.toFixed(6), note: "自今日 00:00 起", icon: Activity, tone: "bg-fuchsia-50 text-fuchsia-600" },
  ];
  return <div className="space-y-8">
    <section><div className="mb-5"><p className="eyebrow">Operations overview</p><h2 className="mt-2 font-serif text-3xl font-semibold">运营与消耗概览</h2><p className="mt-2 text-sm text-black/45">实时查看用户、Token 用量、模型成本及算力点流转。</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">{cards.map(({ label, value, note, icon: Icon, tone }) => <div key={label} className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-xl"><div className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon className="size-5" /></div><p className="mt-5 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-sm font-medium">{label}</p><p className="mt-1 text-xs text-black/40">{note}</p></div>)}</div></section>
    <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-black/10 px-5 py-4"><div><h3 className="flex items-center gap-2 font-semibold"><ReceiptText className="size-4 text-ember" />最近用户消耗</h3><p className="mt-1 text-xs text-black/40">展示最近 8 条模型调用扣费</p></div></div>{recent.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-black/[.025] text-xs text-black/45"><tr><th className="px-5 py-3 font-medium">用户</th><th className="px-5 py-3 font-medium">说明</th><th className="px-5 py-3 font-medium">消耗点数</th><th className="px-5 py-3 font-medium">扣后余额</th><th className="px-5 py-3 font-medium">时间</th></tr></thead><tbody className="divide-y divide-black/5">{recent.map((item) => <tr key={item.id} className="hover:bg-black/[.02]"><td className="px-5 py-3.5">{item.user.email}</td><td className="max-w-xs truncate px-5 py-3.5 text-black/50">{item.description}</td><td className="px-5 py-3.5 font-semibold text-orange-600">{Math.abs(Number(item.amount)).toFixed(6)}</td><td className="px-5 py-3.5">{Number(item.balanceAfter).toFixed(6)}</td><td className="px-5 py-3.5 text-black/45">{item.createdAt.toLocaleString("zh-CN")}</td></tr>)}</tbody></table></div> : <div className="grid h-40 place-items-center text-sm text-black/40">暂无消耗记录</div>}</section>
  </div>;
}
