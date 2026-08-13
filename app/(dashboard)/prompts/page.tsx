import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-user";
import { isAdminEmail } from "@/lib/admin";
export default async function LegacyPromptsPage() {
  const user = await requireUser();
  redirect(isAdminEmail(user.email) ? "/admin/novel-types" : "/projects");
}
