import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      username: string;
      role: "user" | "admin";
      bio: string;
    };
  }

  interface User {
    id?: string | null;
    username?: string;
    role?: "user" | "admin";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    username?: string;
    role?: "user" | "admin";
    bio?: string;
  }
}
