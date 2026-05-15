import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth";
import { TutorialClient } from "./tutorial-client";

export const dynamic = "force-dynamic";

export default async function TutorialPage() {
  const user = await getSessionUser();
  if (!user) redirect("/");
  if (user.mustChangePassword) redirect("/force-password");

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username;
  return <TutorialClient userName={fullName} userRole={user.organization || "Member"} />;
}
