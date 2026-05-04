import { redirect } from "next/navigation";
import { PasswordChangeForm } from "@/components/password-change-form";
import { getSessionUser } from "@/services/auth";

export default async function ForcePasswordPage() {
  const session = await getSessionUser();
  if (!session) redirect("/");
  return <PasswordChangeForm forced={session.mustChangePassword} />;
}
