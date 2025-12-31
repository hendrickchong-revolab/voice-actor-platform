import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;

        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user?.password) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      // Important for dev/test environments where the DB is frequently reset:
      // a previously-issued JWT may still be cryptographically valid even though
      // the user row no longer exists. Revalidate the user id against the DB.
      if (token.id) {
        const existing = await db.user.findUnique({
          where: { id: String(token.id) },
          select: { id: true, role: true },
        });

        if (!existing) {
          // Returning an empty token will cause session() to return null.
          return {};
        }

        // Keep role in sync with DB in case it changed.
        token.role = existing.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.id) {
        // Session callback cannot return null in NextAuth v4; instead, remove user info.
        return { ...session, user: undefined };
      }
      if (session.user) {
        if (token.id) session.user.id = token.id;
        if (token.role) session.user.role = token.role;
      }
      return session;
    },
  },
};
