import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  email: z.string().trim().email("请输入有效邮箱").max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8, "密码至少 8 位").max(72, "密码不能超过 72 位"),
});

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "注册信息不正确", 400, parsed.error.flatten());

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({ data: { email: parsed.data.email, passwordHash } });
    return Response.json({ data: { id: user.id, email: user.email } }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError("CONFLICT", "该邮箱已经注册", 409);
    }
    return apiError("INTERNAL_ERROR", "注册暂时不可用", 500);
  }
}
