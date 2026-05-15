import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { invitations, loginAttempts, roles, sessions, userRoles, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getClientMeta } from "@/lib/utils";
import { writeAudit, type AuditActor } from "./audit";

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "saberx_session";
const SESSION_DAYS = 7;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const [session] = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      username: users.username,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      organization: users.organization,
      accountStatus: users.accountStatus,
      mustChangePassword: users.mustChangePassword,
      tutorialSeen: users.tutorialSeen,
      expiresAt: sessions.expiresAt,
      revokedAt: sessions.revokedAt
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()), isNull(users.deletedAt)))
    .limit(1);

  if (!session || session.accountStatus !== "active") return null;
  return session;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  if (user.mustChangePassword) throw new Error("Password change required");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  const [role] = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.userId, user.userId), eq(roles.name, "Admin")))
    .limit(1);
  if (!role) throw new Error("Forbidden");
  return user;
}

export function actorFromUser(user: { userId: string; username: string }): AuditActor {
  return { id: user.userId, username: user.username };
}

export async function login(username: string, password: string) {
  const requestHeaders = await headers();
  const meta = getClientMeta(requestHeaders);
  const normalized = username.trim();
  const [user] = await db.select().from(users).where(eq(users.username, normalized)).limit(1);
  const ok = user && user.accountStatus === "active" && (await verifyPassword(user.passwordHash, password));

  await db.insert(loginAttempts).values({
    username: normalized,
    success: Boolean(ok),
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
    failureReason: ok ? null : "invalid_credentials"
  });

  if (!ok) {
    await writeAudit({
      actionType: "LOGIN_FAIL",
      entityType: "user",
      entityId: user?.id ?? null,
      actor: { id: user?.id ?? null, username: normalized },
      summary: `Failed login for ${normalized}`,
      sourceType: "security",
      success: false,
      requestMeta: meta
    });
    throw new Error("Invalid username or password");
  }

  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.transaction(async (tx) => {
    await tx.insert(sessions).values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress: meta.ip,
      userAgent: meta.userAgent
    });
    await tx.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
    await writeAudit(
      {
        actionType: "LOGIN_SUCCESS",
        entityType: "user",
        entityId: user.id,
        actor: { id: user.id, username: user.username },
        summary: `Successful login for ${user.username}`,
        sourceType: "security",
        requestMeta: meta
      },
      tx
    );
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      mustChangePassword: user.mustChangePassword
    }
  };
}

export async function logout() {
  const user = await getSessionUser();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.update(sessions).set({ revokedAt: new Date(), updatedAt: new Date() }).where(eq(sessions.tokenHash, hashToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
  if (user) {
    await writeAudit({
      actionType: "LOGOUT",
      entityType: "session",
      entityId: user.sessionId,
      actor: { id: user.userId, username: user.username },
      summary: `Logout for ${user.username}`,
      sourceType: "security"
    });
  }
}

export async function changeOwnPassword(input: { currentPassword?: string; newPassword: string }, forced = false) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) throw new Error("Unauthorized");
  if (!forced) {
    const valid = input.currentPassword ? await verifyPassword(user.passwordHash, input.currentPassword) : false;
    if (!valid) throw new Error("Current password is incorrect");
  }
  const nextHash = await hashPassword(input.newPassword);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: nextHash, mustChangePassword: false, updatedAt: new Date() }).where(eq(users.id, user.id));
    await tx.update(sessions).set({ revokedAt: new Date(), updatedAt: new Date() }).where(and(eq(sessions.userId, user.id), sql`${sessions.id} <> ${session.sessionId}`));
    await writeAudit(
      {
        actionType: "PASSWORD_CHANGE",
        entityType: "user",
        entityId: user.id,
        actor: { id: user.id, username: user.username },
        before: { mustChangePassword: user.mustChangePassword },
        after: { mustChangePassword: false },
        summary: `Password changed for ${user.username}`,
        sourceType: "security"
      },
      tx
    );
  });
}

export async function createInvitation(actor: { userId: string; username: string }, input: { email: string; username: string; roles: string[] }) {
  const token = newToken(48);
  const tokenHash = hashToken(`${process.env.INVITATION_SECRET ?? ""}:${token}`);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const txId = randomUUID();
  const [created] = await db.transaction(async (tx) => {
    const [invitation] = await tx
      .insert(invitations)
      .values({
        invitedEmail: input.email.toLowerCase(),
        preassignedUsername: input.username,
        intendedRoles: input.roles,
        invitedBy: actor.userId,
        tokenHash,
        expiresAt
      })
      .returning();
    await writeAudit(
      {
        transactionId: txId,
        actor: { id: actor.userId, username: actor.username },
        actionType: "INVITATION_CREATE",
        entityType: "invitation",
        entityId: invitation.id,
        after: invitation,
        summary: `Created invitation for ${input.email}`,
        sourceType: "security"
      },
      tx
    );
    return [invitation];
  });
  return {
    invitation: created,
    activationUrl: `${process.env.APP_ORIGIN ?? "http://localhost:3000"}/invitations/${token}`
  };
}

export async function revokeInvitation(actor: { userId: string; username: string }, id: string) {
  const [before] = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
  if (!before) throw new Error("Invitation not found");
  const [after] = await db
    .update(invitations)
    .set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(invitations.id, id))
    .returning();
  await writeAudit({
    actor: { id: actor.userId, username: actor.username },
    actionType: "INVITATION_REVOKE",
    entityType: "invitation",
    entityId: id,
    before,
    after,
    summary: `Revoked invitation for ${before.invitedEmail}`,
    sourceType: "security"
  });
  return after;
}

// Resolves an invitation token to the public-facing details (username, email)
// shown on the activation page. Returns null for any token that has been used,
// revoked, or expired so we don't leak the existence of stale invitations.
export async function lookupInvitation(rawToken: string) {
  const tokenHash = hashToken(`${process.env.INVITATION_SECRET ?? ""}:${rawToken}`);
  const [invitation] = await db
    .select({
      id: invitations.id,
      invitedEmail: invitations.invitedEmail,
      preassignedUsername: invitations.preassignedUsername,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      revokedAt: invitations.revokedAt,
      usedAt: invitations.usedAt
    })
    .from(invitations)
    .where(eq(invitations.tokenHash, tokenHash))
    .limit(1);
  if (!invitation) return null;
  if (invitation.status !== "pending" || invitation.revokedAt || invitation.usedAt || invitation.expiresAt < new Date()) {
    return null;
  }
  return {
    email: invitation.invitedEmail,
    username: invitation.preassignedUsername
  };
}

export async function acceptInvitation(rawToken: string, password: string) {
  const tokenHash = hashToken(`${process.env.INVITATION_SECRET ?? ""}:${rawToken}`);
  const [invitation] = await db.select().from(invitations).where(eq(invitations.tokenHash, tokenHash)).limit(1);
  if (!invitation || invitation.status !== "pending" || invitation.revokedAt || invitation.usedAt || invitation.expiresAt < new Date()) {
    throw new Error("Invitation is invalid or expired");
  }

  const passwordHash = await hashPassword(password);
  const [created] = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        username: invitation.preassignedUsername,
        email: invitation.invitedEmail,
        passwordHash,
        accountStatus: "active",
        mustChangePassword: false,
        createdBy: invitation.invitedBy
      })
      .returning();
    const roleRows = invitation.intendedRoles.length ? await tx.select().from(roles).where(inArray(roles.name, invitation.intendedRoles)) : [];
    if (roleRows.length) {
      await tx.insert(userRoles).values(roleRows.map((role) => ({ userId: user.id, roleId: role.id }))).onConflictDoNothing();
    }
    await tx.update(invitations).set({ status: "used", usedAt: new Date(), updatedAt: new Date() }).where(eq(invitations.id, invitation.id));
    await writeAudit(
      {
        actor: { id: user.id, username: user.username },
        actionType: "INVITATION_ACCEPT",
        entityType: "user",
        entityId: user.id,
        after: user,
        summary: `Invitation accepted by ${user.username}`,
        sourceType: "security"
      },
      tx
    );
    return [user];
  });
  return created;
}

export async function listActivity(userId: string, admin = false) {
  const { auditEvents } = await import("@/db/schema");
  const condition = admin ? undefined : eq(auditEvents.actingUserId, userId);
  const query = db.select().from(auditEvents).orderBy(desc(auditEvents.timestamp)).limit(100);
  return condition ? query.where(condition) : query;
}
