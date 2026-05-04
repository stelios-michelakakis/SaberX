import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/services/auth";

export default async function SnapshotsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/");
  if (session.mustChangePassword) redirect("/force-password");
  return (
    <main className="admin-page">
      <Link className="button" href="/workspace">
        Workspace
      </Link>
      <section className="panel">
        <h1>Snapshots And Baselines</h1>
        <p>Snapshot creation is available through each document API endpoint: <code>POST /api/documents/:id/snapshots</code>.</p>
      </section>
    </main>
  );
}
