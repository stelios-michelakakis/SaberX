import { redirect } from "next/navigation";
import { desc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
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
  const [issues, docList] = await Promise.all([
    listIntegrityIssues().catch(() => []),
    db
      .select({ id: documents.id, title: documents.title })
      .from(documents)
      .where(isNull(documents.deletedAt))
      .orderBy(desc(documents.updatedAt))
      .limit(50)
      .catch(() => [])
  ]);

  return (
    <ThemeProvider>
      <Shell
        user={{ name: fullName, role: user.organization || "Member" }}
        integrityCount={issues.length}
        documents={docList}
        tutorialSeen={user.tutorialSeen}
      >
        {children}
      </Shell>
    </ThemeProvider>
  );
}
