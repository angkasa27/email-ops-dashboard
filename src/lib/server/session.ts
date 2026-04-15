import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { readSessionPayload, sessionCookieName } from "./auth";
import { env } from "./env";

export async function getSession() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(sessionCookieName)?.value;
  return await readSessionPayload({ cookieValue, secret: env.SESSION_SECRET });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return session;
}
