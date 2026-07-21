import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return apiError("UNAUTHORIZED", "请先登录", 401);
  const requestedPage = Number(new URL(request.url).searchParams.get("page") || 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 10;
  const [user, total, pointTransactions] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, points: true, createdAt: true } }),
    prisma.pointTransaction.count({ where: { userId: session.user.id } }),
    prisma.pointTransaction.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  if (!user) return apiError("NOT_FOUND", "账户不存在", 404);
  return Response.json({
    data: {
      ...user,
      points: user.points.toString(),
      isAdmin: isAdminEmail(user.email),
      pointTransactions: pointTransactions.map((item) => ({ ...item, amount: item.amount.toString(), balanceAfter: item.balanceAfter.toString() })),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    },
  });
}
