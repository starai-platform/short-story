import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const databaseModel = await prisma.aiModel.count({ where: { isActive: true } });
    return Response.json({ status: "ok", database: "ok", modelConfigured: databaseModel > 0 || Boolean(process.env.LLM_API_KEY && process.env.LLM_MODEL) });
  } catch {
    return Response.json({ status: "degraded", database: "error", modelConfigured: Boolean(process.env.LLM_API_KEY && process.env.LLM_MODEL) }, { status: 503 });
  }
}
