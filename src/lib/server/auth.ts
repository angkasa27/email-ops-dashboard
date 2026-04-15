import { SignJWT, jwtVerify } from "jose";
import { createHash, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "monitor_email_session";

type VerifyAdminCredentialsInput = {
  username: string;
  password: string;
  adminUsername: string;
  adminPassword: string;
};

function secureCompare(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function verifyAdminCredentials(input: VerifyAdminCredentialsInput): Promise<boolean> {
  return secureCompare(input.username, input.adminUsername) && secureCompare(input.password, input.adminPassword);
}

export async function createSessionCookieValue(input: { username: string; secret: string }): Promise<string> {
  return await new SignJWT({ username: input.username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecretKey(input.secret));
}

export async function readSessionPayload(input: {
  cookieValue: string | undefined;
  secret: string;
}): Promise<{ username: string } | null> {
  if (!input.cookieValue) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(input.cookieValue, getSecretKey(input.secret));
    if (typeof payload.username !== "string") {
      return null;
    }

    return { username: payload.username };
  } catch {
    return null;
  }
}

export function buildSessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export const sessionCookieName = SESSION_COOKIE;
