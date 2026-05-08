import { redirect } from "next/navigation";
import { Shell } from "@/components/saberx/shell";
import { ThemeProvider } from "@/components/saberx/theme-provider";
import { getSessionUser } from "@/services/auth";
import { listIntegrityIssues } from "@/services/repository";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/");
  if (user.mustChangePassword) redirect("/force-password");

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username;
  const issues = await listIntegrityIssues().catch(() => []);

  return (
    <ThemeProvider>
      <Shell
        user={{ name: fullName, role: user.organization || "Member" }}
        programName="Sentinel-7 ISR"
        integrityCount={issues.length}
      >
        {children}
      </Shell>
    </ThemeProvider>
  );
}
