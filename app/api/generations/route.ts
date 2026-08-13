import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireActiveApi } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authz = await requireActiveApi();
  if ("error" in authz) return authz.error;
  const url = new URL(request.url);
  const page = z.coerce.number().int().min(1).catch(1).parse(url.searchParams.get("page"));
  const pageSize = z.coerce.number().int().min(1).max(50).catch(12).parse(url.searchParams.get("pageSize"));
  const where = { userId: authz.user.id };
  const [items, total] = await prisma.$transaction([
    prisma.generation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        promptNameSnapshot: true,
        input: true,
        output: true,
        status: true,
        model: true,
        totalTokens: true,
        durationMs: true,
        createdAt: true,
      },
    }),
    prisma.generation.count({ where }),
  ]);
  return Response.json({ data: items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}
