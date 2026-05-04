import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, userRoles, users } from "@/db/schema";
import { ok, mapError } from "@/lib/api";
import { requireAdmin } from "@/services/auth";

export async function GET() {
  try {
    await requireAdmin();
    const userRows = await db.select().from(users).orderBy(desc(users.createdAt));
    const roleRows = await db.select({ userId: userRoles.userId, roleName: roles.name }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId));
    return ok({
      users: userRows.map((user) => ({ ...user, roles: roleRows.filter((role) => role.userId === user.id).map((role) => role.roleName) }))
    });
  } catch (error) {
    return mapError(error);
  }
}
