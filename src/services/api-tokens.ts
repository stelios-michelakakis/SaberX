import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiTokens, roles, userRoles, users } from "@/db/schema";
import { writeAudit } from "./audit";

const TOKEN_PREFIX = "sbx_";
const TOKEN_BYTES = 32;

export type ApiUser = {
  userId: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  organization: string | null;
  accountStatus: string;
  mustChangePassword: boolean;
  tokenId: string;
  tokenName: string;
  readOnly: boolean;
  roles: string[];
};

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken() {
  return TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString("base64url");
}

export async function listApiTokens(userId: string) {
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      readOnly: apiTokens.readOnly,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
      expiresAt: apiTokens.expiresAt,
      revokedAt: apiTokens.revokedAt
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt));
}

export async function createApiToken(
  user: { userId: string; username: string },
  input: { name: string; readOnly?: boolean; expiresAt?: Date | null }
) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const [created] = await db
    .insert(apiTokens)
    .values({
      userId: user.userId,
      name: input.name.trim() || "Unnamed token",
      tokenHash,
      readOnly: input.readOnly ?? false,
      expiresAt: input.expiresAt ?? null
    })
    .returning();
  await writeAudit({
    actor: { id: user.userId, username: user.username },
    actionType: "PROFILE_UPDATE",
    entityType: "api_token",
    entityId: created.id,
    summary: `Created API token "${created.name}"${created.readOnly ? " (read-only)" : ""}`,
    sourceType: "security"
  });
  return { token, record: created };
}

export async function revokeApiToken(
  user: { userId: string; username: string },
  tokenId: string
) {
  const [before] = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, user.userId)))
    .limit(1);
  if (!before) throw new Error("Token not found");
  if (before.revokedAt) return before;
  const [after] = await db
    .update(apiTokens)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(apiTokens.id, tokenId))
    .returning();
  await writeAudit({
    actor: { id: user.userId, username: user.username },
    actionType: "PROFILE_UPDATE",
    entityType: "api_token",
    entityId: tokenId,
    before,
    after,
    summary: `Revoked API token "${before.name}"`,
    sourceType: "security"
  });
  return after;
}

export async function authenticateApiToken(token: string): Promise<ApiUser | null> {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;
  const tokenHash = hashToken(token);
  const [row] = await db
    .select({
      tokenId: apiTokens.id,
      tokenName: apiTokens.name,
      readOnly: apiTokens.readOnly,
      userId: users.id,
      username: users.username,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      organization: users.organization,
      accountStatus: users.accountStatus,
      mustChangePassword: users.mustChangePassword
    })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(
      and(
        eq(apiTokens.tokenHash, tokenHash),
        isNull(apiTokens.revokedAt),
        isNull(users.deletedAt),
        or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, new Date()))
      )
    )
    .limit(1);

  if (!row) return null;
  if (row.accountStatus !== "active" || row.mustChangePassword) return null;

  // Fire-and-forget: bump lastUsedAt
  await db
    .update(apiTokens)
    .set({ lastUsedAt: sql`now()` })
    .where(eq(apiTokens.id, row.tokenId));

  const roleRows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, row.userId));

  return {
    userId: row.userId,
    username: row.username,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    organization: row.organization,
    accountStatus: row.accountStatus,
    mustChangePassword: row.mustChangePassword,
    tokenId: row.tokenId,
    tokenName: row.tokenName,
    readOnly: row.readOnly,
    roles: roleRows.map((r) => r.name)
  };
}

export function userIsAdmin(user: { roles: string[] }) {
  return user.roles.includes("Admin");
}

export function userIsReadOnly(user: { roles: string[]; readOnly: boolean }) {
  return user.readOnly || (user.roles.length > 0 && user.roles.every((r) => r === "Reviewer"));
}
