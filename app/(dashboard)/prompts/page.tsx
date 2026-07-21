import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
export default async function LegacyPromptsPage() { const session = await auth(); redirect(isAdminEmail(session?.user?.email) ? "/admin/novel-types" : "/projects"); }
