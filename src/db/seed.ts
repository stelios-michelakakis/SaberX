import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { permissions, rolePermissions, roles, userRoles, users } from "@/db/schema";
import { hashPassword } from "@/lib/password";

const ROLE_NAMES = ["Admin", "Document Manager", "Editor", "Reviewer"] as const;

const PERMISSIONS = [
  "app.admin",
  "document.create",
  "document.read",
  "document.update",
  "document.delete",
  "sheet.manage",
  "schema.manage",
  "row.edit",
  "row.delete",
  "audit.read",
  "user.manage",
  "import.run",
  "export.run",
  "integrity.read"
];

async function main() {
  const roleRows = [];
  for (const roleName of ROLE_NAMES) {
    const [role] = await db
      .insert(roles)
      .values({ name: roleName, description: `${roleName} role`, isSystem: true })
      .onConflictDoUpdate({ target: roles.name, set: { description: `${roleName} role`, updatedAt: new Date() } })
      .returning();
    roleRows.push(role);
  }

  const permissionRows = [];
  for (const code of PERMISSIONS) {
    const [permission] = await db
      .insert(permissions)
      .values({ code, description: code })
      .onConflictDoUpdate({ target: permissions.code, set: { description: code } })
      .returning();
    permissionRows.push(permission);
  }

  const adminRole = roleRows.find((role) => role.name === "Admin");
  if (adminRole) {
    await db
      .insert(rolePermissions)
      .values(permissionRows.map((permission) => ({ roleId: adminRole.id, permissionId: permission.id })))
      .onConflictDoNothing();
  }

  const [existingAdmin] = await db.select().from(users).where(eq(users.username, "admin")).limit(1);
  if (!existingAdmin) {
    const [admin] = await db
      .insert(users)
      .values({
        username: "admin",
        email: "admin@example.local",
        passwordHash: await hashPassword("admin"),
        accountStatus: "active",
        mustChangePassword: true,
        firstName: "Bootstrap",
        lastName: "Admin"
      })
      .returning();
    if (adminRole) {
      await db.insert(userRoles).values({ userId: admin.id, roleId: adminRole.id }).onConflictDoNothing();
    }
    console.log("Seeded bootstrap admin/admin. First login must change password.");
  } else {
    console.log("Bootstrap admin already exists.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
