import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await getSessionUser();
  if (session?.mustChangePassword) redirect("/force-password");
  if (session) redirect("/dashboard");
  return <LoginForm />;
}
