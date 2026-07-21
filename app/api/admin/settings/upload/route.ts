import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireAdminApi } from "@/lib/admin";
import { apiError } from "@/lib/api";

const allowed = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
  ["image/x-icon", ".ico"],
  ["image/vnd.microsoft.icon", ".ico"],
]);

export async function POST(request: Request) {
  const admin = await requireAdminApi(); if ("error" in admin) return admin.error;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind") === "favicon" ? "favicon" : "logo";
  if (!(file instanceof File)) return apiError("VALIDATION_ERROR", "请选择图片文件", 400);
  const extension = allowed.get(file.type);
  if (!extension) return apiError("VALIDATION_ERROR", "仅支持 PNG、JPG、WebP 或 ICO 图片", 400);
  if (file.size <= 0 || file.size > 2 * 1024 * 1024) return apiError("VALIDATION_ERROR", "图片大小必须在 2MB 以内", 400);
  const directory = path.join(process.cwd(), "public", "uploads");
  await mkdir(directory, { recursive: true });
  const filename = `${kind}-${Date.now()}-${randomBytes(4).toString("hex")}${extension}`;
  await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()));
  return Response.json({ data: { url: `/uploads/${filename}` } }, { status: 201 });
}
