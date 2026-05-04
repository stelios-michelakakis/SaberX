import { redirect } from "next/navigation";
import { AdminUsersClient } from "@/components/admin-users-client";
import { getSessionUser } from "@/services/auth";

export default async function AdminUsersPage() {
  const session = await getSessionUser();
  if (!session) redirect("/");
  if (session.mustChangePassword) redirect("/force-password");
  return <AdminUsersClient />;
}
