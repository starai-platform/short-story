"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function LogoutButton() {
  return <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-black/55 transition hover:bg-black/5 hover:text-black"><LogOut className="size-4" />退出登录</button>;
}
