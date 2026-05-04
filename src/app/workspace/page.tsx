import { redirect } from "next/navigation";
import { WorkspaceClient } from "@/components/workspace/workspace-client";
import { getSessionUser } from "@/services/auth";

export default async function WorkspacePage() {
  const session = await getSessionUser();
  if (!session) redirect("/");
  if (session.mustChangePassword) redirect("/force-password");
  return <WorkspaceClient />;
}
