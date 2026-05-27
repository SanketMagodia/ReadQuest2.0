import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";

export async function getAppSession() {
  return getServerSession(authOptions);
}
