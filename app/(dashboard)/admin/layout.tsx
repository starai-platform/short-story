import Link from "next/link";
import { Bot, LayoutDashboard, Settings, Tags, TicketPercent, Users } from "lucide-react";
import { requireAdminPage } from "@/lib/admin";

const tabs = [{ href: "/admin", label: "概览", icon: LayoutDashboard }, { href: "/admin/models", label: "AI 模型", icon: Bot }, { href: "/admin/users", label: "用户", icon: Users }, { href: "/admin/codes", label: "兑换码", icon: TicketPercent }, { href: "/admin/novel-types", label: "小说类型", icon: Tags }, { href: "/admin/settings", label: "系统设置", icon: Settings }];
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return <div className="mx-auto max-w-7xl"><header className="mb-6"><p className="eyebrow">Administration</p><h1 className="mt-2 font-serif text-3xl font-semibold md:text-4xl">管理中心</h1></header><nav className="mb-8 flex gap-2 overflow-x-auto pb-2">{tabs.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="btn-secondary shrink-0"><Icon className="size-4" />{label}</Link>)}</nav>{children}</div>;
}
