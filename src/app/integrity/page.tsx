import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/services/auth";
import { listIntegrityIssues } from "@/services/repository";

export default async function IntegrityPage() {
  const session = await getSessionUser();
  if (!session) redirect("/");
  if (session.mustChangePassword) redirect("/force-password");
  const issues = await listIntegrityIssues();
  return (
    <main className="admin-page">
      <Link className="button" href="/workspace">
        Workspace
      </Link>
      <section className="panel">
        <h1>Integrity Dashboard</h1>
        <table className="simple-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Type</th>
              <th>Message</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr key={issue.id}>
                <td>{issue.severity}</td>
                <td>{issue.issueType}</td>
                <td>{issue.message}</td>
                <td>{issue.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
