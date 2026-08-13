import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(72),
});

// Include a short secret fingerprint in the cookie name. When a local install
// creates or intentionally rotates AUTH_SECRET, cookies encrypted with the old
// secret are ignored instead of being sent to Auth.js and producing a noisy
// JWTSessionError on every server-rendered page.
const sessionCookieVersion = createHash("sha256")
  .update(process.env.AUTH_SECRET || "development")
  .digest("hex")
  .slice(0, 12);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  cookies: {
    sessionToken: {
      name: `novel.session-token.${sessionCookieVersion}`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        if (!user || !user.isActive || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null;
        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        if (user.email) token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (typeof token.email === "string") session.user.email = token.email;
      }
      return session;
    },
  },
});
