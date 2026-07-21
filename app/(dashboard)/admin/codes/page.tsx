import { AdminCodes } from "@/components/admin-codes";
import { prisma } from "@/lib/prisma";
export default async function CodesPage() {
  const [codes, records] = await Promise.all([
    prisma.redemptionCode.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.redemptionRecord.findMany({ orderBy: { createdAt: "desc" }, take: 500, include: { code: { select: { code: true } }, user: { select: { email: true } } } }),
  ]);
  return <><div className="mb-6"><p className="eyebrow">Redemption center</p><h2 className="mt-2 font-serif text-3xl font-semibold">兑换码管理</h2><p className="mt-2 text-sm text-black/45">创建和停用兑换码，并查看每一次用户兑换记录。</p></div><AdminCodes codes={codes.map((c) => ({ ...c, points: c.points.toString(), createdAt: c.createdAt.toISOString(), expiresAt: c.expiresAt?.toISOString() || null }))} records={records.map((r) => ({ id: r.id, code: r.code.code, email: r.user.email, points: r.points.toString(), createdAt: r.createdAt.toISOString() }))}/></>;
}
