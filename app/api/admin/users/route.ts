import { requireAdminApi } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const admin = await requireAdminApi(); if ("error" in admin) return admin.error;
  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase();
  const users = await prisma.user.findMany({ where: query ? { email: { contains: query } } : {}, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, email: true, points: true, isActive: true, createdAt: true, _count: { select: { novelProjects: true, generations: true } } } });
  return Response.json({ data: users.map((item) => ({ ...item, points: item.points.toString() })) });
}
