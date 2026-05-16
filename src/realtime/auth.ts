import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "saberx_session";

export type RealtimeIdentity = {
  userId: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
};

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

export async function identifyFromCookie(cookieHeader: string | undefined): Promise<RealtimeIdentity | null> {
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [row] = await db
    .select({
      userId: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      status: users.accountStatus
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
        isNull(users.deletedAt)
      )
    )
    .limit(1);
  if (!row || row.status !== "active") return null;
  return {
    userId: row.userId,
    username: row.username,
    firstName: row.firstName,
    lastName: row.lastName
  };
}
