import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, userRoles } from "@/db/schema";
import { PageHeader } from "@/components/saberx/page-header";
import { getSessionUser } from "@/services/auth";
import { AdminClient } from "./admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/");
  const [adminRole] = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.userId, user.userId), eq(roles.name, "Admin")))
    .limit(1);
  if (!adminRole) {
    return (
      <>
        <PageHeader
          eyebrow="Admin"
          title="Administration"
          subtitle="You don't have access to this area."
        />
        <div style={{ padding: "40px 28px", color: "var(--ink-3)" }}>
          Contact a system administrator if you need access.
        </div>
      </>
    );
  }
  return <AdminClient currentUserId={user.userId} />;
}
