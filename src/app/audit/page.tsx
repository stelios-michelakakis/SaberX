import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getSessionUser } from "@/services/auth";

export default async function AuditPage() {
  const session = await getSessionUser();
  if (!session) redirect("/");
  if (session.mustChangePassword) redirect("/force-password");
  const events = await db.select().from(auditEvents).orderBy(desc(auditEvents.timestamp)).limit(150);
  return (
    <main className="admin-page">
      <Link className="button" href="/workspace">
        Workspace
      </Link>
      <section className="panel">
        <h1>Audit Log</h1>
        <table className="simple-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.timestamp.toLocaleString()}</td>
                <td>{event.actingUsername}</td>
                <td>{event.actionType}</td>
                <td>{event.entityType}</td>
                <td>{event.summaryText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
