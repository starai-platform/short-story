import bcrypt from "bcryptjs";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireActiveApi } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";

const schema = z.object({ currentPassword: z.string().min(8).max(72), newPassword: z.string().min(8).max(72) });

export async function POST(request: Request) {
  const authz = await requireActiveApi();
  if ("error" in authz) return authz.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "密码长度应为 8–72 位", 400);
  const user = await prisma.user.findUnique({ where: { id: authz.user.id } });
  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) return apiError("VALIDATION_ERROR", "当前密码不正确", 400);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) } });
  return Response.json({ data: { success: true } });
}
