import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { getAuthSecret } from "@/lib/auth-secret";

const googleEnabled =
  Boolean(process.env.AUTH_GOOGLE_ID) && Boolean(process.env.AUTH_GOOGLE_SECRET);

export const authOptions: NextAuthOptions = {
  secret: getAuthSecret(),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
          }),
        ]
      : []),
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = (credentials?.username as string)?.toLowerCase().trim();
        const password = credentials?.password as string;
        if (!username || !password) return null;

        await connectDB();
        const dbUser = await User.findOne({ username }).select("+passwordHash");
        if (!dbUser?.passwordHash) return null;

        const ok = await bcrypt.compare(password, dbUser.passwordHash);
        if (!ok) return null;

        return {
          id: dbUser._id.toString(),
          name: dbUser.name || dbUser.username,
          email: dbUser.email ?? undefined,
          image: dbUser.image ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      const p = profile as {
        email?: string | null;
        name?: string | null;
        picture?: string | null;
      } | null;

      if (account?.provider === "google" && account.providerAccountId && p?.email) {
        await hydrateGoogleUser(
          token as JWT,
          {
            email: p.email.toLowerCase(),
            name: typeof p.name === "string" ? p.name : null,
            picture: typeof p.picture === "string" ? p.picture : null,
          },
          account.providerAccountId
        );
      } else if (account?.provider === "credentials" && user?.id) {
        await hydrateUserFromId(token as JWT, user.id as string);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id =
          (typeof token.uid === "string" && token.uid) || (token.sub as string) || "";
        session.user.username = typeof token.username === "string" ? token.username : "";
        session.user.role = token.role === "admin" ? "admin" : "user";
        session.user.bio = typeof token.bio === "string" ? token.bio : "";
      }
      return session;
    },
  },
};

async function hydrateUserFromId(token: JWT, id: string) {
  await connectDB();
  const u = await User.findById(id);
  if (!u) return;
  token.uid = u._id.toString();
  token.sub = token.uid;
  token.username = u.username;
  token.role = u.role as "user" | "admin";
  token.bio = u.bio;
}

async function hydrateGoogleUser(
  token: JWT,
  profile: { email: string; name: string | null; picture: string | null },
  providerAccountId: string
) {
  await connectDB();
  const email = profile.email;
  const googleId = providerAccountId;

  let u = await User.findOne({ googleId });
  if (!u && email) u = await User.findOne({ email });

  const baseUsername = sanitizeUsername(
    profile.name?.replace(/\s+/g, "").toLowerCase() || email.split("@")[0] || "reader"
  );

  if (!u) {
    let username = baseUsername.slice(0, 24);
    let suffix = 0;
    while (await User.findOne({ username })) {
      suffix += 1;
      username = `${baseUsername.slice(0, 18)}_${suffix}`;
    }
    u = await User.create({
      username,
      email,
      googleId,
      name: profile.name ?? username,
      image: typeof profile.picture === "string" ? profile.picture : undefined,
    });
  } else {
    if (!u.googleId) u.googleId = googleId;
    if (!u.image && typeof profile.picture === "string") u.image = profile.picture;
    if (!u.email && email) u.email = email;
    if (!u.name && profile.name) u.name = profile.name;
    await u.save();
  }

  token.uid = u._id.toString();
  token.sub = token.uid;
  token.username = u.username;
  token.role = u.role as "user" | "admin";
  token.bio = u.bio;
}

function sanitizeUsername(raw: string) {
  return raw.replace(/[^a-z0-9_]/gi, "").toLowerCase().slice(0, 24) || "reader";
}
