import { eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, userRoles, users } from "@/db/schema";
import { PageHeader } from "@/components/saberx/page-header";
import { requireUser } from "@/services/auth";
import { ProfileClient } from "./profile-client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireUser();
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  const userRoleRows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, session.userId));

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="My profile"
        subtitle="Manage your name, organisation, and password."
      />
      <ProfileClient
        user={{
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          organization: user.organization,
          accountStatus: user.accountStatus,
          lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
          createdAt: user.createdAt.toISOString()
        }}
        roles={userRoleRows.map((r) => r.name)}
      />
    </>
  );
}
