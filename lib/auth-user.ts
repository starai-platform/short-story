import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}
